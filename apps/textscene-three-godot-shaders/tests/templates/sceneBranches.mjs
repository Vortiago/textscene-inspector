import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import {
  compileMaterial,
  templateVariant,
  usageDefineOf,
} from '../../../../packages/textscene-core/src/shaders/template/link.ts';
import { MODE_TABLES } from '../../../../packages/textscene-core/src/shaders/template/modeTables.generated.ts';
import { preprocess } from '../../../../packages/textscene-core/src/shaders/template/preprocess.ts';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';

/** Godot's colour pass with no pass flags, which `transpileSpatial` links. */
const SCENE_FILE = 'forward_clustered/scene_forward_clustered.glsl';

/** The state of a branch a scene against Godot takes. */
export const DRAWN = 'drawn against Godot';

/** The state of a branch a material's define takes and no scene takes yet, with the rows of that define. */
export const OPEN = 'open';

/** The state of a branch no unshaded material takes: a lit branch, a pass flag or a build option. */
export const NOT_A_MATERIAL_BRANCH = 'taken by no unshaded material';

const STAGES = ['vertex', 'fragment'];

/** Each branch of `stage`, by `file:line`, and whether the variant of `material` takes it. */
function decidedBranches(stage, material) {
  return preprocess(templateVariant(SCENE_FILE, stage, '', material)).branches.map((branch) => ({
    key: `${branch.file}:${branch.line}`,
    isTaken: branch.isTaken,
  }));
}

/** A material of no code and no defines. */
const NO_MATERIAL = { custom: [], hasUniforms: false, code: new Map() };

/** The owner of `id` in the instruction table, or `transpiled`. */
function ownerOf(id) {
  const row = INSTRUCTION_TABLE.find((each) => each.id === id);
  if (!row) throw new Error(`expected a row ${id} in the instruction table, found none`);
  return row.owner || 'transpiled';
}

/** The owner of a user's spatial shader, which a uniform of it shares. */
const USER_SHADER_OWNER = ownerOf('spatial.vertex.VERTEX');

/** The defines a shader makes past its usage and render modes, with their rows and owners. */
const MATERIAL_PARTS = [
  { material: { ...NO_MATERIAL, hasUniforms: true }, rows: [['a uniform of the shader', USER_SHADER_OWNER]] },
];

/** Each material of one define a spatial shader can make, with the rows that make it and their owners. */
function definedMaterials() {
  const table = MODE_TABLES.spatial;
  const rows = new Map();
  const add = (define, row) => rows.set(define, [...(rows.get(define) ?? []), [row, ownerOf(row)]]);
  for (const [mode, define] of Object.entries(table.render_mode_defines))
    add(define, `spatial render_mode ${mode}`);
  for (const name of Object.keys(table.usage_defines)) {
    const define = usageDefineOf(table, name);
    for (const row of INSTRUCTION_TABLE)
      if (/^spatial\.(vertex|fragment)\./.test(row.id) && row.id.endsWith(`.${name}`)) add(define, row.id);
  }
  return [
    ...[...rows].map(([define, defineRows]) => ({
      material: { ...NO_MATERIAL, custom: [define] },
      rows: defineRows,
    })),
    ...MATERIAL_PARTS,
  ];
}

/** The material of each scene source, as the transpiler compiles it. */
const sceneMaterials = (sources) =>
  [...new Set(sources)].map((source) =>
    compileMaterial(parse(tokenize(source, 'scene.gdshader')), MODE_TABLES.spatial)
  );

/** The branches of `stage` that the variant of each scene material takes. */
function drawnBranches(stage, materials) {
  return new Set(
    materials.flatMap((material) =>
      decidedBranches(stage, material)
        .filter((branch) => branch.isTaken)
        .map((branch) => branch.key)
    )
  );
}

/** `material` as an unshaded one: `unshaded` joins its defines. */
function unshadedOf(material) {
  const unshaded = MODE_TABLES.spatial.render_mode_defines.unshaded;
  return { ...material, custom: [...new Set([unshaded, ...material.custom])] };
}

/** The rows of each branch some unshaded material takes, and every branch an unshaded material decides. */
function materialBranches(stage, materials) {
  const takenBy = new Map();
  const decided = new Set();
  for (const { material, rows } of materials) {
    for (const { key, isTaken } of decidedBranches(stage, unshadedOf(material))) {
      decided.add(key);
      if (isTaken) takenBy.set(key, [...(takenBy.get(key) ?? []), ...rows]);
    }
  }
  return { takenBy, decided };
}

/** An open branch's state: each row whose define takes it, with the row's owner. */
const openState = (rows) =>
  `${OPEN}: ${[...new Set(rows.map(([row, owner]) => `${row} (${owner})`))].sort().join(', ')}`;

/** The state of each `#if` branch of the unshaded colour pass, by stage, then by `file:line`. */
export function sceneBranchStates(sources) {
  const scenes = sceneMaterials(sources);
  const defined = definedMaterials();
  return Object.fromEntries(
    STAGES.map((stage) => {
      const drawn = drawnBranches(stage, scenes);
      const { takenBy, decided } = materialBranches(stage, defined);
      const states = [...decided].map((key) => {
        if (drawn.has(key)) return [key, DRAWN];
        return [key, takenBy.has(key) ? openState(takenBy.get(key)) : NOT_A_MATERIAL_BRANCH];
      });
      return [stage, Object.fromEntries(states.sort(([a], [b]) => byFileLine(a, b)))];
    })
  );
}

function byFileLine(a, b) {
  const [fileA, lineA] = a.split(':');
  const [fileB, lineB] = b.split(':');
  return fileA === fileB ? Number(lineA) - Number(lineB) : fileA.localeCompare(fileB);
}
