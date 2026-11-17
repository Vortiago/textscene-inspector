import { createHash } from 'node:crypto';
import { eachAtOnce, oneGodot, printedField, RUNS_AT_ONCE, runGodotScript } from './godotRun.mjs';

const MARKER = 'MATERIAL ';
const DONE = 'MATERIALS DONE';

/** The last part of the id of a stencil's next pass, after its material's id. */
export const NEXT_PASS = 'next_pass';

/** The material classes whose text BaseMaterial3D writes: ORMMaterial3D sets the key's `orm` bit. */
export const MATERIAL_CLASSES = ['StandardMaterial3D', 'ORMMaterial3D'];

/** Godot gives a script no material's shader RID, so it reads the one shader between two of its own. */
const MATERIAL_SCRIPT = `extends Node

const SLOT_BITS := 4294967296

func values_of(p: Dictionary) -> Array:
	if p.type == TYPE_BOOL:
		return [true]
	if p.type != TYPE_INT:
		return []
	var names: PackedStringArray = p.hint_string.split(",")
	if p.hint == PROPERTY_HINT_ENUM:
		return range(names.size())
	if p.hint == PROPERTY_HINT_FLAGS:
		var bits := []
		for bit in names.size():
			bits.append(1 << bit)
		bits.append((1 << names.size()) - 1)
		return bits
	if p.hint == PROPERTY_HINT_RANGE:
		return [int(names[0]), int(names[0]) + 1, int(names[1])]
	return []

func sweep() -> Array:
	var singles := []
	for p in ClassDB.class_get_property_list("BaseMaterial3D", true):
		for value in values_of(p):
			singles.append([p.name, value])
	var cases := [[]]
	for single in singles:
		cases.append([single])
	for first in singles.size():
		for second in range(first + 1, singles.size()):
			if singles[first][0] != singles[second][0]:
				cases.append([singles[first], singles[second]])
	return cases

func id_of(cls: String, settings: Array) -> String:
	var parts := [cls]
	for setting in settings:
		parts.append("%s=%s" % [setting[0], setting[1]])
	return "|".join(parts)

func shader_in(before: RID, after: RID, slots: Array) -> String:
	for counter in range(before.get_id() / SLOT_BITS + 1, after.get_id() / SLOT_BITS):
		for slot in slots:
			var code := RenderingServer.shader_get_code(rid_from_int64(counter * SLOT_BITS + slot))
			if code != "":
				return code
	return ""

func shader_between(before: RID, after: RID) -> String:
	var first_slot: int = mini(before.get_id() % SLOT_BITS, after.get_id() % SLOT_BITS)
	var last_slot: int = maxi(before.get_id() % SLOT_BITS, after.get_id() % SLOT_BITS)
	var code := shader_in(before, after, range(maxi(first_slot - 1, 0), last_slot + 2))
	return code if code != "" else shader_in(before, after, range(64))

func made(cls: String, settings: Array) -> Material:
	var material: Material = ClassDB.instantiate(cls)
	for setting in settings:
		material.set(setting[0], setting[1])
	return material

## A frame inside the window lets the server free the shaders of the cases before, or memory runs out.
func text_of(material: Material) -> String:
	var before := RenderingServer.shader_create()
	material.get_rid()
	await get_tree().process_frame
	var after := RenderingServer.shader_create()
	var code := shader_between(before, after)
	RenderingServer.free_rid(before)
	RenderingServer.free_rid(after)
	return code

func record(id: String, material: Material) -> void:
	printerr("${MARKER}", id, " ", Marshalls.utf8_to_base64(await text_of(material)))

## Each window holds one shader: a stencil's next pass is measured alone, with its material freed.
func record_case(cls: String, settings: Array) -> void:
	var material := made(cls, settings)
	var next := material.next_pass
	material.next_pass = null
	if next != null:
		material = null
		await record(id_of(cls, settings) + "|${NEXT_PASS}", next)
		next = null
		material = made(cls, settings)
		material.next_pass = null
	await record(id_of(cls, settings), material)
	material = null
	# A material of the same key that is still alive would lend the next case its shader.
	await get_tree().process_frame

func _ready() -> void:
	var run: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://run.json"))
	printerr("GODOT ", Engine.get_version_info().string)
	var cases := sweep()
	var index := 0
	for cls in run.classes:
		for settings in cases:
			if index % int(run.chunks) == int(run.chunk):
				await record_case(cls, settings)
			index += 1
	printerr("${DONE}")
	get_tree().quit()
`;

/** The hex SHA-256 of a text, as a material case holds it. */
export const sha256 = (text) => createHash('sha256').update(text).digest('hex');

/** Each case's text from `output`, by its id. Throws when the run did not end or a text is missing. */
export function parseMaterialOutput(output) {
  if (!output.includes(DONE)) throw new Error(`expected "${DONE}" in Godot's output, found none`);
  const lines = output
    .split(DONE)[0]
    .split('\n')
    .filter((line) => line.startsWith(MARKER));
  return lines.map((line) => {
    const [id, encoded] = line.slice(MARKER.length).trim().split(' ');
    const text = Buffer.from(encoded ?? '', 'base64').toString('utf8');
    if (text === '') throw new Error(`expected Godot's shader text for material ${id}, found none`);
    return { id, text };
  });
}

/** A case id as `id_of` writes it, `Class|property=value|...`, then `|next_pass` for a next pass. */
export function parseCaseId(id) {
  const [materialClass, ...parts] = id.split('|');
  const isNextPass = parts.at(-1) === NEXT_PASS;
  const settings = (isNextPass ? parts.slice(0, -1) : parts).map((setting) => {
    const [name, value] = setting.split('=');
    return [name, value === 'true' ? true : Number(value)];
  });
  return { materialClass, settings: Object.fromEntries(settings), isNextPass };
}

/** Godot's text of each material of the sweep: the record holds each case's hash, `texts` each text. */
export async function materialRecord() {
  const chunks = Array.from({ length: RUNS_AT_ONCE }, (_, chunk) => chunk);
  const runs = await eachAtOnce(chunks, async (chunk) => {
    const output = await runGodotScript(MATERIAL_SCRIPT, {
      'run.json': JSON.stringify({ classes: MATERIAL_CLASSES, chunk, chunks: RUNS_AT_ONCE }),
    });
    return { godot: printedField(output, 'GODOT '), texts: parseMaterialOutput(output) };
  });
  const { godot } = oneGodot(runs);
  const entries = runs
    .flatMap((run) => run.texts)
    .map(({ id, text }) => ({ id, text, hash: sha256(text) }))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const cases = Object.fromEntries(entries.map(({ id, hash }) => [id, hash]));
  const texts = Object.fromEntries(entries.map(({ text, hash }) => [hash, text]));
  return { record: { godot, cases }, texts };
}
