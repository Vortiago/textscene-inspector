import type { PropertyValidator } from '../../ValidatorRegistry.js';
import { propertyError } from '../propertyError.js';
import { tupleComponent } from '../commonValidators.js';
import { slotComponents, slotComponentsAltered, ruleInt } from '../../../godot/variant/intSlots.js';
import { convertedSpelling, markIntSlot, truncatedComponent } from '../intSlot.js';
import { floatTupleValidator, makeFloatTupleRegex } from '../floatTupleValidator.js';
import {
  VECTOR2_REGEX,
  VECTOR3_REGEX,
  createRect2Validator,
  createTransform3DValidator,
  createVector2Validator,
  createVector2iValidator,
  createVector3Validator,
} from '../vectorValidators.js';
import { compositeTypeName, isConvertedSpelling } from '../../../godot/variant/variantConversion.js';
import { INT_TOKEN_RE } from '../../../godot/variant/number.js';
import { isColorString } from '../../../godot/math/color.js';
import { STRING_LITERAL_RE } from '../../../godot/string/string.js';
import { unquoteString } from '../../../parser/utils.js';
import { formatCode, numericRange, valueCode } from './codes.js';
import { accepts, endSeverity, ground, shape, type Grounding } from './grounding.js';

const UNNAMED_COLOR = 'color.cpp:396-402';

/** A refusal that is not a range, on the stored components. Null passes. */
export type ComponentRule = (
  parts: number[],
  written: string
) => { message: string; severity?: 'error' | 'warning' } | null;

// A format error wins, and a refusal wins over the truncation warning.
function componentRule(
  validator: PropertyValidator,
  name: string,
  typeName: string,
  arity: number,
  rule: ComponentRule,
  opts: Grounding
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  const guarded: PropertyValidator = (key, value, line) => {
    const first = validator(key, value, line);
    if (first?.severity === 'error') return first;
    const match = regex.exec(value);
    if (!match) return first;
    const parts = slotComponents(value, typeName, match.slice(1, arity + 1), tupleComponent);
    const refusal = rule(parts, value);
    if (refusal) return propertyError(key, line, refusal.message, valueCode(name), refusal.severity);
    return first;
  };
  guarded.accepts = validator.accepts;
  const cites = (end: Grounding['enforced']) =>
    end === undefined
      ? []
      : typeof end === 'string'
        ? [end]
        : [end.min, end.max].filter((c): c is string => !!c);
  const enforced = cites(opts.enforced);
  const hinted = cites(opts.hinted).filter((c) => !enforced.includes(c));
  if (enforced.length > 0)
    guarded.grounding = { kind: 'enforced', cite: [...enforced, ...hinted].join(', ') };
  else if (hinted.length > 0) guarded.grounding = { kind: 'hinted', cite: hinted.join(', ') };
  return guarded;
}

// An integer spelling's non-finite argument is an alteration, which `floatTupleValidator` reports.
function finiteComponents(
  validator: PropertyValidator,
  name: string,
  typeName: string,
  arity: number,
  cite: string
): PropertyValidator {
  const regex = makeFloatTupleRegex(typeName, arity);
  const guarded: PropertyValidator = (key, value, line) => {
    const format = validator(key, value, line);
    if (format) return format;
    const match = regex.exec(value);
    if (!match) return null;
    if (isConvertedSpelling(typeName, compositeTypeName(value))) return null;
    const components = match.slice(1, arity + 1).map((c) => tupleComponent(c));
    if (components.some((c) => !Number.isFinite(c))) {
      return propertyError(
        key,
        line,
        `Property '${name}' must have finite components; Godot's setter returns ` +
          `without storing "${value.trim()}"`,
        valueCode(name)
      );
    }
    return null;
  };
  guarded.accepts = validator.accepts;
  guarded.grounding = { kind: 'enforced', cite };
  return guarded;
}

interface IntTupleShape {
  readonly typeName: 'Rect2i' | 'Vector3i';
  readonly regex: RegExp;
  readonly arity: number;
  readonly fields: string;
}

// Any number token, not `-?\d+`: a float component loads and truncates (variant_parser.cpp:577-592).
const RECT2I_SHAPE: IntTupleShape = {
  typeName: 'Rect2i',
  regex: makeFloatTupleRegex('Rect2i', 4),
  arity: 4,
  fields: 'x, y, w, h',
};
const VECTOR3I_SHAPE: IntTupleShape = {
  typeName: 'Vector3i',
  regex: makeFloatTupleRegex('Vector3i', 3),
  arity: 3,
  fields: 'x, y, z',
};

function intTuple(
  name: string,
  { typeName, regex, arity, fields }: IntTupleShape,
  acceptsLabel: string
): PropertyValidator {
  const code = formatCode(name);
  const valueErrorCode = valueCode(name);
  return markIntSlot(
    shape((key, value, line) => {
      const match = regex.exec(value);
      if (!match) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be ${typeName}(${fields}) with integer components, got: ${value}`,
          code
        );
      }
      const components = match.slice(1, arity + 1);
      // A float spelling holds doubles, so every component takes the `double -> int32` branch.
      const converted = isConvertedSpelling(typeName, compositeTypeName(value));
      if (components.some((component) => ruleInt(component, null, 'int32', converted) === null)) {
        return propertyError(
          key,
          line,
          `Property '${name}' has a component no integer can hold, got: ${value}`,
          valueErrorCode,
          'error'
        );
      }
      return truncatedComponent(name, key, line, components, valueErrorCode);
    }, acceptsLabel)
  );
}

interface FloatVectorShape {
  readonly typeName: 'Vector2' | 'Vector3';
  readonly regex: RegExp;
  readonly arity: number;
  readonly fields: string;
}

const VECTOR2_SHAPE: FloatVectorShape = {
  typeName: 'Vector2',
  regex: VECTOR2_REGEX,
  arity: 2,
  fields: 'x, y',
};
const VECTOR3_SHAPE: FloatVectorShape = {
  typeName: 'Vector3',
  regex: VECTOR3_REGEX,
  arity: 3,
  fields: 'x, y, z',
};

function boundedFloatVector(
  name: string,
  { typeName, regex, arity, fields }: FloatVectorShape,
  opts: { min?: number; max?: number } & Grounding
): PropertyValidator {
  const { min, max } = opts;
  const minSeverity = endSeverity(opts, 'min');
  const maxSeverity = endSeverity(opts, 'max');
  const example = `${typeName}(${Array(arity).fill(1).join(', ')})`;
  return ground(
    accepts(
      (key, value, line) => {
        const match = regex.exec(value);
        if (!match) {
          return propertyError(
            key,
            line,
            `Property '${name}' must be ${typeName} with ${arity} numbers like ${example}, got: "${value}"`,
            formatCode(name)
          );
        }
        const captures = match.slice(1, arity + 1);
        // An altered component is NaN to the bounds, and its stored value is undefined (variant.h:369-370).
        if (slotComponentsAltered(value, typeName, captures)) {
          return propertyError(
            key,
            line,
            `Property '${name}' has a component Godot cannot store in the integer spelling it is written in, got: "${value}". ` +
              'The file loads, but the components are narrowed at parse time to a number the file does not state.',
            valueCode(name),
            'error'
          );
        }
        // An integer spelling narrows to int32 before it widens into this slot.
        const parts = slotComponents(value, typeName, captures, tupleComponent);
        const belowMin = min !== undefined && parts.some((c) => c < min);
        const aboveMax = max !== undefined && parts.some((c) => c > max);
        if (belowMin || aboveMax) {
          const bound =
            min !== undefined && max !== undefined
              ? `between ${min} and ${max}`
              : min !== undefined
                ? `>= ${min}`
                : `<= ${max}`;
          return propertyError(
            key,
            line,
            `Property '${name}' components must be ${bound}, got: ${typeName}(${parts.join(', ')})`,
            valueCode(name),
            belowMin ? minSeverity : maxSeverity
          );
        }
        // After the bounds, so the warning never masks an enforced bound (variant_parser.cpp:721-723).
        if (isConvertedSpelling(typeName, compositeTypeName(value))) {
          return truncatedComponent(name, key, line, captures, valueCode(name));
        }
        return null;
      },
      `${typeName}(${fields}), each ${numericRange('float', min, max)}`
    ),
    opts,
    { min, max }
  );
}

export const vectorCombinators = {
  rect2i(name: string): PropertyValidator {
    return intTuple(name, RECT2I_SHAPE, 'Rect2i(x, y, w, h), or the Rect2 spelling Godot converts');
  },

  vector3i(name: string): PropertyValidator {
    return intTuple(name, VECTOR3I_SHAPE, 'Vector3i(x, y, z), or the Vector3 spelling Godot converts');
  },

  vector4(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(
        name,
        'Vector4',
        4,
        'Vector4 with 4 numbers like Vector4(0, 0, 0, 0)',
        formatCode(name)
      ),
      'Vector4(x, y, z, w), or the Vector4i spelling Godot converts'
    );
  },

  /** `finite` cites a setter that refuses `inf` and `nan`: the loader stores both. */
  vector2(
    name: string,
    opts: { finite?: string; components?: ComponentRule; accepts?: string } & Grounding = {}
  ): PropertyValidator {
    const format = shape(
      createVector2Validator(name, formatCode(name)),
      opts.accepts ?? 'Vector2(x, y), or the Vector2i spelling Godot converts'
    );
    const ruled = opts.components ? componentRule(format, name, 'Vector2', 2, opts.components, opts) : format;
    return opts.finite ? finiteComponents(ruled, name, 'Vector2', 2, opts.finite) : ruled;
  },

  vector2i(name: string, opts: { min?: number } & Grounding = {}): PropertyValidator {
    const { min } = opts;
    return markIntSlot(
      ground(
        accepts(
          createVector2iValidator(name, min, formatCode(name), valueCode(name), endSeverity(opts, 'min')),
          min === undefined
            ? 'Vector2i(x, y), or the Vector2 spelling Godot converts'
            : `Vector2i(x, y), both >= ${min}, or the Vector2 spelling Godot converts`
        ),
        opts,
        { min }
      )
    );
  },

  vector3(
    name: string,
    opts: { components?: ComponentRule; accepts?: string } & Grounding = {}
  ): PropertyValidator {
    const format = shape(
      createVector3Validator(name, formatCode(name)),
      opts.accepts ?? 'Vector3(x, y, z), or the Vector3i spelling Godot converts'
    );
    return opts.components ? componentRule(format, name, 'Vector3', 3, opts.components, opts) : format;
  },

  boundedVector2(name: string, opts: { min?: number; max?: number } & Grounding = {}): PropertyValidator {
    return boundedFloatVector(name, VECTOR2_SHAPE, opts);
  },

  boundedVector3(name: string, opts: { min?: number; max?: number } & Grounding = {}): PropertyValidator {
    return boundedFloatVector(name, VECTOR3_SHAPE, opts);
  },

  rect2(name: string): PropertyValidator {
    return shape(
      createRect2Validator(name, formatCode(name)),
      'Rect2(x, y, w, h), or the Rect2i spelling Godot converts'
    );
  },

  transform3d(name: string): PropertyValidator {
    return shape(createTransform3DValidator(name, formatCode(name)), 'Transform3D(12 floats)');
  },

  // An int or colour string converts (variant.cpp:712-719, :1986-1996). Another string stores black.
  color(name: string): PropertyValidator {
    const code = formatCode(name);
    const tuple = floatTupleValidator(name, 'Color', 4, 'Color with 4 numbers like Color(1, 1, 1, 1)', code);
    const validator: PropertyValidator = (key, value, line) => {
      const trimmed = value.trim();
      if (INT_TOKEN_RE.test(trimmed)) {
        return convertedSpelling(name, key, value, line, code, 'the Color it encodes', true);
      }
      if (!STRING_LITERAL_RE.test(trimmed)) return tuple(key, value, line);
      if (isColorString(unquoteString(trimmed))) {
        return convertedSpelling(name, key, value, line, code, 'the Color it names', true);
      }
      return propertyError(
        key,
        line,
        `Property '${name}' is the string ${trimmed}, which is no HTML colour or colour name, so Godot stores black (${UNNAMED_COLOR})`,
        valueCode(name)
      );
    };
    validator.grounding = { kind: 'enforced', cite: UNNAMED_COLOR };
    return accepts(validator, 'Color(r, g, b, a), or the colour string or int it converts');
  },

  aabb(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(
        name,
        'AABB',
        6,
        'AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1)',
        formatCode(name)
      ),
      'AABB(x, y, z, w, h, d)'
    );
  },

  quaternion(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(
        name,
        'Quaternion',
        4,
        'Quaternion with 4 numbers like Quaternion(0, 0, 0, 1)',
        formatCode(name)
      ),
      'Quaternion(x, y, z, w)'
    );
  },

  plane(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Plane', 4, 'Plane with 4 numbers like Plane(0, 1, 0, 0)', formatCode(name)),
      'Plane(nx, ny, nz, d)'
    );
  },

  transform2d(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(
        name,
        'Transform2D',
        6,
        'Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0)',
        formatCode(name)
      ),
      'Transform2D(6 floats)'
    );
  },

  basis(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(
        name,
        'Basis',
        9,
        'Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)',
        formatCode(name)
      ),
      'Basis(9 floats)'
    );
  },
};
