import { parse } from '../../../../packages/textscene-core/src/shaders/language/parse.ts';
import { tokenize } from '../../../../packages/textscene-core/src/shaders/language/tokenizer.ts';
import {
  compileMaterial,
  templateVariant,
} from '../../../../packages/textscene-core/src/shaders/template/link.ts';
import { MODE_TABLES } from '../../../../packages/textscene-core/src/shaders/template/modeTables.generated.ts';
import { preprocess } from '../../../../packages/textscene-core/src/shaders/template/preprocess.ts';

/** Godot's colour pass with no pass flags, which `transpileSpatial` links. */
const SCENE_FILE = 'forward_clustered/scene_forward_clustered.glsl';

/** The state of a branch a scene against Godot takes. */
export const DRAWN = 'drawn against Godot';

/** The state of a branch a material's define takes and no scene against Godot takes yet. */
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

/** A material of no code with `custom` defines: what a shader of those built-ins and modes makes. */
const definesOnly = (custom) => ({ custom, code: new Map() });

/** Every define a spatial material can make, unshaded first, as `compileMaterial` writes each. */
function materialDefines() {
  const table = MODE_TABLES.spatial;
  const resolved = Object.values(table.usage_defines).map((define) =>
    define.startsWith('@') ? table.usage_defines[define.slice(1)] : define
  );
  return [
    ...new Set([
      table.render_mode_defines.unshaded,
      ...Object.values(table.render_mode_defines),
      ...resolved,
    ]),
  ];
}

/** The unshaded path: the unshaded define alone, and with each other define a material can make. */
function unshadedMaterials() {
  const [unshaded, ...others] = materialDefines();
  return [definesOnly([unshaded]), ...others.map((define) => definesOnly([unshaded, define]))];
}

/** The material of each scene source, as the transpiler compiles it. */
const sceneMaterials = (sources) =>
  [...new Set(sources)].map((source) =>
    compileMaterial(parse(tokenize(source, 'scene.gdshader')), MODE_TABLES.spatial)
  );

/** The state of each `#if` branch of the unshaded colour pass, by stage, then by `file:line`. */
export function sceneBranchStates(sources) {
  return Object.fromEntries(
    STAGES.map((stage) => {
      const drawn = new Set(
        sceneMaterials(sources).flatMap((material) =>
          decidedBranches(stage, material)
            .filter((branch) => branch.isTaken)
            .map((branch) => branch.key)
        )
      );
      const decided = unshadedMaterials().flatMap((material) => decidedBranches(stage, material));
      const states = new Map();
      for (const { key, isTaken } of decided) {
        const state = drawn.has(key) ? DRAWN : isTaken ? OPEN : NOT_A_MATERIAL_BRANCH;
        if (states.get(key) !== DRAWN && states.get(key) !== OPEN) states.set(key, state);
      }
      return [stage, Object.fromEntries([...states].sort(([a], [b]) => byFileLine(a, b)))];
    })
  );
}

function byFileLine(a, b) {
  const [fileA, lineA] = a.split(':');
  const [fileB, lineB] = b.split(':');
  return fileA === fileB ? Number(lineA) - Number(lineB) : fileA.localeCompare(fileB);
}
