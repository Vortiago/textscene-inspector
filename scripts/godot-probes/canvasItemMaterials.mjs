#!/usr/bin/env node
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';
import { checkGenerated, writeGenerated } from '../generatedFile.mjs';
import { SHADER_BETWEEN } from './shaderBetween.mjs';
import { requireGodotVersion, runGodotScript } from './godotRun.mjs';
import { godotVerdicts, verdictText } from './shaderVerdicts.mjs';

export const CANVAS_ITEM_MATERIALS_FILE = join(
  REPO_ROOT,
  'apps/textscene-three-godot-shaders/tests/materials/canvasItemMaterials.generated.json'
);

/** Blend 5 is `BLEND_MODE_DISABLED`, which the hint leaves out, and 6 and light 3 are past each switch. */
const BLEND_MODES = [0, 1, 2, 3, 4, 5, 6];
const LIGHT_MODES = [0, 1, 2, 3];

/** Every key of the shader cache (`canvas_item_material.h:66`), with the values past the hints. */
const TEXT_CASES = BLEND_MODES.flatMap((blend_mode) =>
  LIGHT_MODES.flatMap((light_mode) =>
    [false, true].map((particles_animation) => ({ blend_mode, light_mode, particles_animation }))
  )
);

/** The values each particle setter uploads: defaults, ordinary values, 0, negative and past the hint. */
const PARAMETER_CASES = [
  { particles_animation: true },
  {
    particles_animation: true,
    particles_anim_h_frames: 4,
    particles_anim_v_frames: 2,
    particles_anim_loop: true,
  },
  { particles_animation: true, particles_anim_h_frames: 0, particles_anim_v_frames: -3 },
  { particles_animation: true, particles_anim_h_frames: 500, particles_anim_v_frames: 129 },
  { particles_animation: false, particles_anim_h_frames: 3 },
];

const UNIFORMS = ['particles_anim_h_frames', 'particles_anim_v_frames', 'particles_anim_loop'];

const LINE_PREFIX = 'CANVAS_ITEM_MATERIAL ';

const SCRIPT = `extends Node

func material_of(properties: Dictionary) -> Material:
	var material := CanvasItemMaterial.new()
	for property in properties:
		material.set(property, properties[property])
	return material

${SHADER_BETWEEN}
func parameters_of(material: Material) -> Dictionary:
	var values := {}
	for name in ${JSON.stringify(UNIFORMS)}:
		values[name] = var_to_str(RenderingServer.material_get_param(material.get_rid(), name))
	return values

func _ready() -> void:
	for each in ${JSON.stringify(TEXT_CASES)}:
		var code: String = await shader_of(material_of(each))
		print("${LINE_PREFIX}", JSON.stringify({"kind": "text", "case": each, "code": code}))
	for each in ${JSON.stringify(PARAMETER_CASES)}:
		var values := parameters_of(material_of(each))
		print("${LINE_PREFIX}", JSON.stringify({"kind": "parameters", "case": each, "values": values}))
	print("${LINE_PREFIX}", JSON.stringify({"kind": "version", "godot": Engine.get_version_info().string}))
	get_tree().quit()
`;

/** The record of Godot's output: its version, each text case with its code, each parameter case. */
export function parseCanvasItemMaterialOutput(stdout) {
  const lines = stdout
    .split('\n')
    .filter((line) => line.startsWith(LINE_PREFIX))
    .map((line) => JSON.parse(line.slice(LINE_PREFIX.length)));
  const ofKind = (kind) => lines.filter((line) => line.kind === kind);
  const [version] = ofKind('version');
  if (!version) throw new Error(`expected Godot's version line in its output, got:\n${stdout}`);
  return {
    godot: version.godot,
    texts: ofKind('text').map((line) => ({ properties: line.case, code: line.code })),
    parameters: ofKind('parameters').map((line) => ({ properties: line.case, values: line.values })),
  };
}

/** Each text with Godot's compile verdict: a value past the blend switch writes an empty `render_mode`. */
async function withVerdicts(record) {
  const { verdicts } = await godotVerdicts(record.texts.map((each) => each.code));
  return {
    ...record,
    texts: record.texts.map((each, i) => ({ ...each, verdict: verdictText(verdicts[i]) })),
  };
}

async function main() {
  const record = await withVerdicts(parseCanvasItemMaterialOutput(await runGodotScript(SCRIPT, {})));
  requireGodotVersion(record.godot);
  const outputs = [[CANVAS_ITEM_MATERIALS_FILE, `${JSON.stringify(record, null, 1)}\n`]];
  const summary = `${record.texts.length} texts, ${record.parameters.length} parameter sets`;
  const tool = { tool: 'godot:canvas-item-materials', summary };
  if (process.argv.includes('--check'))
    checkGenerated(outputs, { ...tool, command: 'pnpm godot:canvas-item-materials' });
  else writeGenerated(outputs, tool);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();
