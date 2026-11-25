import { attributesVariant } from '../../../../packages/textscene-core/src/shaders/canvas/canvasAttributes.ts';
import { primitiveDraw } from '../../../../packages/textscene-core/src/shaders/canvas/canvasPrimitive.ts';
import { CANVAS_VARIANT_DEFINES } from '../../../../packages/textscene-core/src/shaders/canvas/transpileCanvas.ts';
import { INSTRUCTION_TABLE } from '../../../../packages/textscene-core/src/shaders/language/instructionTable.generated.ts';
import { GENERAL_DEFINES } from '../../../../packages/textscene-core/src/shaders/template/generalDefines.ts';
import { usageDefineOf } from '../../../../packages/textscene-core/src/shaders/template/link.ts';
import { MODE_TABLES } from '../../../../packages/textscene-core/src/shaders/template/modeTables.generated.ts';
import { preprocess } from '../../../../packages/textscene-core/src/shaders/template/preprocess.ts';
import { splitStages } from '../../../../packages/textscene-core/src/shaders/template/stages.ts';
import { TEMPLATE_FILES } from '../../../../packages/textscene-core/src/shaders/template/templateFiles.generated.ts';
import { variantLines } from '../../../../packages/textscene-core/src/shaders/template/variant.ts';

const CANVAS_FILE = 'canvas.glsl';

/** The state of a branch that Godot's default canvas shader takes in a variant a scene draws. */
export const DRAWN = 'drawn against Godot';

/** The state of a branch a user's shader takes and no scene takes yet, with the rows that take it. */
export const OPEN = 'open';

/** The state of a branch of no variant Godot builds: one ubershader iteration has no `UBERSHADER`. */
export const NOT_BUILT = 'taken by no variant Godot builds';

const STAGES = ['vertex', 'fragment'];

const CANVAS_STAGES = splitStages(CANVAS_FILE, (path) => TEMPLATE_FILES[path]);

/** A material's defines with no code: what the default shader, or a shader of some rows, makes. */
const NO_MATERIAL = { custom: [], hasUniforms: false, codeSections: [] };

/** Each branch of `stage` by `file:line`, and whether `variant` with `material`'s defines takes it. */
function decidedBranches(stage, variant, material) {
  const lines = CANVAS_STAGES[stage];
  const defines = {
    general: GENERAL_DEFINES[CANVAS_FILE],
    variant: CANVAS_VARIANT_DEFINES[variant],
    ...material,
  };
  return preprocess(variantLines(lines, defines)).branches.map((branch) => ({
    key: `${branch.file}:${branch.line}`,
    isTaken: branch.isTaken,
  }));
}

const ownerOf = (id) => {
  const row = INSTRUCTION_TABLE.find((each) => each.id === id);
  if (!row) throw new Error(`expected a row ${id} in the instruction table, found none`);
  return row.owner;
};

/** The owner of a user's `canvas_item` shader, which every row of its built-ins names. */
const USER_SHADER_OWNER = ownerOf('canvas_item.vertex.VERTEX');

/** The default shader in a variant no scene draws: the owner of the canvas template. */
const DEFAULT_SHADER = { material: NO_MATERIAL, rows: [['the default shader', '#1612']] };

/** The defines a shader makes past its usage and render modes, with their rows and owners. */
const MATERIAL_PARTS = [
  { material: { ...NO_MATERIAL, hasUniforms: true }, rows: [['a uniform of the shader', USER_SHADER_OWNER]] },
  { material: { ...NO_MATERIAL, codeSections: ['LIGHT'] }, rows: [['light()', USER_SHADER_OWNER]] },
];

/** Each material of one define a canvas shader can make, with the rows that make it and their owners. */
function definedMaterials() {
  const table = MODE_TABLES.canvas_item;
  const rows = new Map();
  const add = (define, row) => rows.set(define, [...(rows.get(define) ?? []), [row, ownerOf(row)]]);
  for (const [mode, define] of Object.entries(table.render_mode_defines))
    add(define, `canvas_item render_mode ${mode}`);
  for (const name of Object.keys(table.usage_defines)) {
    const define = usageDefineOf(table, name);
    for (const row of INSTRUCTION_TABLE)
      if (/^canvas_item\.(vertex|fragment|light)\./.test(row.id) && row.id.endsWith(`.${name}`))
        add(define, row.id);
  }
  return [
    ...[...rows].map(([define, defineRows]) => ({
      material: { ...NO_MATERIAL, custom: [define] },
      rows: defineRows,
    })),
    ...MATERIAL_PARTS,
  ];
}

/** The variant of each draw of a canvas scene, as the page picks it. */
export function drawnVariants(scenes) {
  return new Set(
    scenes.flatMap((scene) => {
      switch (scene.kind) {
        case 'rect':
          return ['quad'];
        case 'ninepatch':
          return ['ninepatch'];
        case 'primitive':
          return scene.primitives.map(({ points }) => primitiveDraw(points.length).variant);
        case 'polygon':
        case 'drawPolygon':
          return ['attributes'];
        case 'mesh':
          return [attributesVariant(scene.surface.primitive)];
        default:
          throw new Error(`expected a canvas scene kind, got ${scene.kind}`);
      }
    })
  );
}

/** The branches of `stage` the default shader takes in each of `variants`. */
const drawnBranches = (stage, variants) =>
  new Set(
    [...variants].flatMap((variant) =>
      decidedBranches(stage, variant, NO_MATERIAL)
        .filter((branch) => branch.isTaken)
        .map((branch) => branch.key)
    )
  );

/** The rows of each branch some material takes in some variant, and every branch a variant decides. */
function materialBranches(stage, materials) {
  const takenBy = new Map();
  const decided = new Set();
  for (const variant of Object.keys(CANVAS_VARIANT_DEFINES))
    for (const { material, rows } of materials)
      for (const { key, isTaken } of decidedBranches(stage, variant, material)) {
        decided.add(key);
        if (isTaken) takenBy.set(key, [...(takenBy.get(key) ?? []), ...rows]);
      }
  return { takenBy, decided };
}

/** An open branch's state: each row that takes it, with the row's owner. */
const openState = (rows) =>
  `${OPEN}: ${[...new Set(rows.map(([row, owner]) => `${row} (${owner})`))].sort().join(', ')}`;

/**
 * The state of each `#if` branch of `canvas.glsl`, by stage, then by `file:line`.
 * @canonical The state of each branch of the canvas template
 */
export function canvasBranchStates(scenes) {
  const variants = drawnVariants(scenes);
  const materials = [DEFAULT_SHADER, ...definedMaterials()];
  return Object.fromEntries(
    STAGES.map((stage) => {
      const drawn = drawnBranches(stage, variants);
      const { takenBy, decided } = materialBranches(stage, materials);
      const states = [...decided].map((key) => {
        if (drawn.has(key)) return [key, DRAWN];
        const rows = takenBy.get(key) ?? [];
        return [key, rows.length > 0 ? openState(rows) : NOT_BUILT];
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
