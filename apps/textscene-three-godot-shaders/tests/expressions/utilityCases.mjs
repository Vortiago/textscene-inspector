import { UTILITY_FUNCTIONS } from '../../../../packages/textscene-core/src/godot/variant/registrations.generated.ts';
import { VALUE_TYPES, valueText } from './values.mjs';

const FITTING_CASES = 4;
const REFUSING_CASES = 2;

// GetTypeInfo<T>::VARIANT_TYPE of each typed parameter: an enum is an INT, and a Variant takes any type.
const PARAMETER_TYPES = {
  double: ['FLOAT', 'INT'],
  float: ['FLOAT', 'INT'],
  int64_t: ['INT'],
  uint64_t: ['INT'],
  Error: ['INT'],
  'Variant::Type': ['INT'],
  String: ['STRING'],
  PackedByteArray: ['PACKED_BYTE_ARRAY'],
  Variant: VALUE_TYPES,
};

const SCALARS = ['INT', 'FLOAT'];
const NUMERIC = [...SCALARS, 'VECTOR2', 'VECTOR2I', 'VECTOR3', 'VECTOR3I', 'VECTOR4', 'VECTOR4I'];
const LERPED = [
  ...SCALARS,
  'VECTOR2',
  'VECTOR3',
  'VECTOR4',
  'QUATERNION',
  'BASIS',
  'COLOR',
  'TRANSFORM2D',
  'TRANSFORM3D',
];

/** The argument types a self-checking function reads, one type shared by its arguments in a fitting case. */
const READ_TYPES = {
  floor: NUMERIC,
  ceil: NUMERIC,
  round: NUMERIC,
  abs: NUMERIC,
  sign: NUMERIC,
  snapped: NUMERIC,
  lerp: LERPED,
  wrap: SCALARS,
  max: SCALARS,
  min: SCALARS,
  clamp: [...SCALARS, 'STRING', 'VECTOR2', 'VECTOR3I'],
  weakref: ['NIL', 'OBJECT'],
};

// The Variant::Type and Error numbers, with one past each end.
const ENUM_TEXTS = {
  'Variant::Type': ['-1', '0', '2', '4', '9', '15', '20', '28', '31', '38', '39', '99'],
  Error: ['-1', '0', '1', '7', '31', '48', '49', '1000'],
};

// A draw is Godot's only after a seed in the same text: one Godot process runs every case.
const DRAWS = new Set(['randi', 'randf', 'randi_range', 'randf_range', 'randfn']);

// Only the null object's id, 0, means one object in every editor.
const OBJECT_IDS = new Set(['instance_from_id', 'is_instance_id_valid']);

// A counter of the running editor answers otherwise on each run, so its case records only the type.
const EDITOR_COUNTERS = new Set(['rid_allocate_id']);

const VARARG_COUNTS = { max: [2, 3, 4], min: [2, 3, 4] };

function fittingArgument(parameter, random) {
  if (ENUM_TEXTS[parameter]) return random.pick(ENUM_TEXTS[parameter]);
  return valueText(random.pick(PARAMETER_TYPES[parameter]), random);
}

function argumentCount(name, count, isVararg, random) {
  if (!isVararg) return count;
  return random.pick(VARARG_COUNTS[name] ?? [0, 1, 2, 3]);
}

function fittingArguments([name, count, isVararg, kind, parameters], random) {
  if (OBJECT_IDS.has(name)) return ['0'];
  if (kind === 'typed') return parameters.map((parameter) => fittingArgument(parameter, random));
  const types = READ_TYPES[name] ?? VALUE_TYPES;
  const type = random.pick(types);
  const texts = Array.from({ length: argumentCount(name, count, isVararg, random) }, () =>
    valueText(type, random)
  );
  if (name === 'lerp') texts[2] = valueText('FLOAT', random);
  return texts;
}

function refusingArguments([name, count, isVararg], random) {
  const length = Math.max(argumentCount(name, count, isVararg, random), 1);
  return Array.from({ length }, () => valueText(random.pick(VALUE_TYPES), random));
}

function caseText(name, args, random) {
  const call = `${name}(${args.join(', ')})`;
  if (EDITOR_COUNTERS.has(name)) return `typeof(${call})`;
  if (!DRAWS.has(name)) return call;
  return `[seed(${valueText('INT', random)}), ${call}, ${call}]`;
}

/** The fitting cases, then the refusing ones, of each utility function, each with its function's name. */
export function utilityCases(random) {
  return UTILITY_FUNCTIONS.flatMap((row) => {
    const name = row[0];
    const fitting = Array.from({ length: FITTING_CASES }, () => fittingArguments(row, random));
    const refusing = OBJECT_IDS.has(name)
      ? []
      : Array.from({ length: REFUSING_CASES }, () => refusingArguments(row, random));
    return [...fitting, ...refusing].map((args, index) => ({
      id: `utility ${name} ${index}`,
      text: caseText(name, args, random),
      utility: name,
    }));
  });
}
