/**
 * The GDScript `shader_of(material)`: RIDs share a counter (`rid_owner.h:167`), so it reads between two.
 * @canonical Read the shader text Godot writes for a material
 */
export const SHADER_BETWEEN = `
const SLOT_BITS := 4294967296
## Every shader of the material sweep sat in one of the first 64 slots of its counter.
const SLOTS := 64

## The first shader found: each empty slot costs an error line in Godot's output.
func shader_in(before: RID, after: RID, slots: Array) -> String:
	for counter in range(before.get_id() / SLOT_BITS + 1, after.get_id() / SLOT_BITS):
		for slot in slots:
			var code := RenderingServer.shader_get_code(rid_from_int64(counter * SLOT_BITS + slot))
			if code != "":
				return code
	return ""

## The slots near the two shaders first: a full search of each counter costs a call per slot.
func shader_between(before: RID, after: RID) -> String:
	var first_slot: int = mini(before.get_id() % SLOT_BITS, after.get_id() % SLOT_BITS)
	var last_slot: int = maxi(before.get_id() % SLOT_BITS, after.get_id() % SLOT_BITS)
	var code := shader_in(before, after, range(maxi(first_slot - 1, 0), last_slot + 2))
	return code if code != "" else shader_in(before, after, range(maxi(last_slot + 2, SLOTS)))

## A frame inside the window lets the server free the shaders of the materials before.
func shader_of(material: Material) -> String:
	var before := RenderingServer.shader_create()
	material.get_rid()
	await get_tree().process_frame
	var after := RenderingServer.shader_create()
	var code := shader_between(before, after)
	RenderingServer.free_rid(before)
	RenderingServer.free_rid(after)
	return code
`;
