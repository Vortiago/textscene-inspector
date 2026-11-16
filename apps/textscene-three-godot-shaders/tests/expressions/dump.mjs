import { variantTypeNameOf } from '../../../../packages/textscene-core/src/godot/variant/variantType.ts';

const hex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');

function dumpFloat(value) {
  if (Number.isNaN(value)) return 'nan';
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, true);
  return `f${hex(new Uint8Array(view.buffer))}`;
}

const dumpText = (text) => hex(new TextEncoder().encode(text));
const call = (name, parts) => `${name}(${parts.join(', ')})`;
const floats = (...values) => values.map(dumpFloat);
const ints = (...values) => values.map(String);
const vector2 = (v) => floats(v.x, v.y);
const vector3 = (v) => floats(v.x, v.y, v.z);
const vector4 = (v) => floats(v.x, v.y, v.z, v.w);
const color = (c) => floats(c.r, c.g, c.b, c.a);
const nodePath = ({ absolute, names, subnames }) =>
  call('NodePath', [
    absolute ? '/' : '.',
    ...names.map((name) => `n${dumpText(name)}`),
    ...subnames.map((subname) => `s${dumpText(subname)}`),
  ]);

const PACKED_NAMES = {
  PACKED_BYTE_ARRAY: ['PackedByteArray', String],
  PACKED_INT32_ARRAY: ['PackedInt32Array', String],
  PACKED_INT64_ARRAY: ['PackedInt64Array', String],
  PACKED_FLOAT32_ARRAY: ['PackedFloat32Array', dumpFloat],
  PACKED_FLOAT64_ARRAY: ['PackedFloat64Array', dumpFloat],
  PACKED_STRING_ARRAY: ['PackedStringArray', (text) => `s${dumpText(text)}`],
  PACKED_VECTOR2_ARRAY: ['PackedVector2Array', (v) => call('Vector2', vector2(v))],
  PACKED_VECTOR3_ARRAY: ['PackedVector3Array', (v) => call('Vector3', vector3(v))],
  PACKED_COLOR_ARRAY: ['PackedColorArray', (c) => call('Color', color(c))],
  PACKED_VECTOR4_ARRAY: ['PackedVector4Array', (v) => call('Vector4', vector4(v))],
};

/** The text of the port's Variant `{ type, value }`. */
export function dumpVariant({ type, value }) {
  switch (type) {
    case 'NIL':
      return 'null';
    case 'BOOL':
    case 'INT':
      return String(value);
    case 'FLOAT':
      return dumpFloat(value);
    case 'STRING':
      return `s${dumpText(value)}`;
    case 'STRING_NAME':
      return `n${dumpText(value)}`;
    case 'NODE_PATH':
      return nodePath(value);
    case 'VECTOR2':
      return call('Vector2', vector2(value));
    case 'VECTOR2I':
      return call('Vector2i', ints(value.x, value.y));
    case 'RECT2':
      return call('Rect2', floats(value.x, value.y, value.w, value.h));
    case 'RECT2I':
      return call('Rect2i', ints(value.x, value.y, value.w, value.h));
    case 'VECTOR3':
      return call('Vector3', vector3(value));
    case 'VECTOR3I':
      return call('Vector3i', ints(value.x, value.y, value.z));
    case 'TRANSFORM2D':
      return call('Transform2D', floats(value.a, value.b, value.c, value.d, value.tx, value.ty));
    case 'VECTOR4':
      return call('Vector4', vector4(value));
    case 'VECTOR4I':
      return call('Vector4i', ints(value.x, value.y, value.z, value.w));
    case 'PLANE':
      return call('Plane', [...vector3(value.normal), ...floats(value.d)]);
    case 'QUATERNION':
      return call('Quaternion', vector4(value));
    case 'AABB':
      return call('AABB', [...vector3(value.position), ...vector3(value.size)]);
    case 'BASIS':
      return call('Basis', floats(...value));
    case 'TRANSFORM3D':
      return call(
        'Transform3D',
        [value.basis_x, value.basis_y, value.basis_z, value.origin].flatMap(vector3)
      );
    case 'PROJECTION':
      return call('Projection', value.flatMap(vector4));
    case 'COLOR':
      return call('Color', color(value));
    case 'RID':
      // `RID::get_id` returns the uint64 id as a GDScript int, an int64.
      return call('RID', [String(BigInt.asIntN(64, value))]);
    case 'OBJECT':
      return 'Object(null)';
    case 'CALLABLE':
      if (value.base) return `Callable(${variantTypeNameOf(value.base.type)}::${value.method})`;
      return value.method === '' ? 'Callable()' : `Callable(null::${value.method})`;
    case 'SIGNAL':
      return value === '' ? 'Signal()' : `Signal(null::[signal]${value})`;
    case 'ARRAY':
      return `[${value.map(dumpVariant).join(', ')}]`;
    case 'DICTIONARY':
      return `{${value.map((entry) => `${dumpVariant(entry.key)}: ${dumpVariant(entry.value)}`).join(', ')}}`;
    default: {
      const [name, element] = PACKED_NAMES[type];
      return `${name}[${value.map(element).join(', ')}]`;
    }
  }
}

/** The same text from GDScript: `dump(v)` of a main script. */
export const DUMP_GDSCRIPT = `
func hex(bytes: PackedByteArray) -> String:
	return bytes.hex_encode()

func dump_float(value: float) -> String:
	if is_nan(value):
		return "nan"
	return "f" + hex(PackedFloat64Array([value]).to_byte_array())

func dump_text(text: String) -> String:
	return hex(text.to_utf8_buffer())

func call_text(name: String, parts: Array) -> String:
	return name + "(" + ", ".join(PackedStringArray(parts)) + ")"

func floats(values: Array) -> Array:
	return values.map(dump_float)

func ints(values: Array) -> Array:
	return values.map(func(value): return str(value))

func v2(v) -> Array:
	return floats([v.x, v.y])

func v3(v) -> Array:
	return floats([v.x, v.y, v.z])

func v4(v) -> Array:
	return floats([v.x, v.y, v.z, v.w])

func color(c) -> Array:
	return floats([c.r, c.g, c.b, c.a])

func node_path(v: NodePath) -> String:
	var parts := ["/" if v.is_absolute() else "."]
	for index in v.get_name_count():
		parts.append("n" + dump_text(String(v.get_name(index))))
	for index in v.get_subname_count():
		parts.append("s" + dump_text(String(v.get_subname(index))))
	return call_text("NodePath", parts)

func packed(name: String, values) -> String:
	var parts := []
	for value in values:
		parts.append(dump(value))
	return name + "[" + ", ".join(PackedStringArray(parts)) + "]"

func dump(v) -> String:
	match typeof(v):
		TYPE_NIL: return "null"
		TYPE_BOOL: return "true" if v else "false"
		TYPE_INT: return str(v)
		TYPE_FLOAT: return dump_float(v)
		TYPE_STRING: return "s" + dump_text(v)
		TYPE_STRING_NAME: return "n" + dump_text(String(v))
		TYPE_NODE_PATH: return node_path(v)
		TYPE_VECTOR2: return call_text("Vector2", v2(v))
		TYPE_VECTOR2I: return call_text("Vector2i", ints([v.x, v.y]))
		TYPE_RECT2: return call_text("Rect2", v2(v.position) + v2(v.size))
		TYPE_RECT2I: return call_text("Rect2i", ints([v.position.x, v.position.y, v.size.x, v.size.y]))
		TYPE_VECTOR3: return call_text("Vector3", v3(v))
		TYPE_VECTOR3I: return call_text("Vector3i", ints([v.x, v.y, v.z]))
		TYPE_TRANSFORM2D: return call_text("Transform2D", v2(v.x) + v2(v.y) + v2(v.origin))
		TYPE_VECTOR4: return call_text("Vector4", v4(v))
		TYPE_VECTOR4I: return call_text("Vector4i", ints([v.x, v.y, v.z, v.w]))
		TYPE_PLANE: return call_text("Plane", v3(v.normal) + floats([v.d]))
		TYPE_QUATERNION: return call_text("Quaternion", v4(v))
		TYPE_AABB: return call_text("AABB", v3(v.position) + v3(v.size))
		TYPE_BASIS: return call_text("Basis", v3(Vector3(v.x.x, v.y.x, v.z.x)) + v3(Vector3(v.x.y, v.y.y, v.z.y)) + v3(Vector3(v.x.z, v.y.z, v.z.z)))
		TYPE_TRANSFORM3D:
			var b: Basis = v.basis
			return call_text("Transform3D", v3(Vector3(b.x.x, b.y.x, b.z.x)) + v3(Vector3(b.x.y, b.y.y, b.z.y)) + v3(Vector3(b.x.z, b.y.z, b.z.z)) + v3(v.origin))
		TYPE_PROJECTION: return call_text("Projection", v4(v.x) + v4(v.y) + v4(v.z) + v4(v.w))
		TYPE_COLOR: return call_text("Color", color(v))
		TYPE_RID: return call_text("RID", [str(v.get_id())])
		TYPE_OBJECT: return "Object(null)" if v == null else "Object(" + v.get_class() + ")"
		TYPE_CALLABLE: return "Callable()" if v.is_null() else "Callable(" + str(v) + ")"
		TYPE_SIGNAL: return "Signal()" if v.is_null() else "Signal(" + str(v) + ")"
		TYPE_ARRAY:
			var parts := []
			for element in v:
				parts.append(dump(element))
			return "[" + ", ".join(PackedStringArray(parts)) + "]"
		TYPE_DICTIONARY:
			var parts := []
			for key in v:
				parts.append(dump(key) + ": " + dump(v[key]))
			return "{" + ", ".join(PackedStringArray(parts)) + "}"
		TYPE_PACKED_BYTE_ARRAY: return packed("PackedByteArray", v)
		TYPE_PACKED_INT32_ARRAY: return packed("PackedInt32Array", v)
		TYPE_PACKED_INT64_ARRAY: return packed("PackedInt64Array", v)
		TYPE_PACKED_FLOAT32_ARRAY: return packed("PackedFloat32Array", v)
		TYPE_PACKED_FLOAT64_ARRAY: return packed("PackedFloat64Array", v)
		TYPE_PACKED_STRING_ARRAY: return packed("PackedStringArray", v)
		TYPE_PACKED_VECTOR2_ARRAY: return packed("PackedVector2Array", v)
		TYPE_PACKED_VECTOR3_ARRAY: return packed("PackedVector3Array", v)
		TYPE_PACKED_COLOR_ARRAY: return packed("PackedColorArray", v)
		TYPE_PACKED_VECTOR4_ARRAY: return packed("PackedVector4Array", v)
	return "unknown(" + type_string(typeof(v)) + ")"
`;
