/**
 * Declarative validator namespace `v` — the thin DSL that lets each
 * node's `linterParser.ts` become a flat property → combinator map.
 *
 * Before this file the 31
 * `linterParser.ts` files totalled 9,488 LOC of near-identical
 * `parseFloat → NaN check → range check → return {ParseError shape}`.
 * Each validator now collapses to a single call site of ~30 chars.
 *
 * Each `v.xxx(propertyName, options?)` returns a `PropertyValidator`
 * (`(key, value, line) => ParseError | null`). Error codes are
 * auto-derived from the property name (uppercase + `_FORMAT` / `_VALUE`
 * suffix), so per-property call sites no longer pass them. Message
 * text follows the same template the existing files use (so all
 * `expect(msg).toContain('cast_shadow')` and `toContain('0-3')` style
 * tests keep passing).
 *
 * Built on top of the existing `create*Validator` factories in this
 * directory; this file is a façade, not a re-implementation.
 */

import type { PropertyValidator } from '../ValidatorRegistry.js';
import type { Severity } from '../types.js';
import { propertyError } from './propertyError.js';
import { VECTOR3_REGEX } from './vectorValidators.js';
import { floatTupleValidator } from './floatTupleValidator.js';
import {
  createBooleanValidator,
  createEnumValidator,
  createNumericRangeValidator,
  createPositiveIntegerValidator,
  parseGodotFloat,
  tupleComponent,
  TSCN_FLOAT_RE,
} from './commonValidators.js';
import {
  createNodePathValidator,
  createResourceReferenceValidator,
  createStringValidator,
} from './resourceValidators.js';
import {
  createRect2Validator,
  createTransform3DValidator,
  createVector2Validator,
  createVector2iValidator,
  createVector3Validator,
} from './vectorValidators.js';

/**
 * Convert `cast_shadow` → `CAST_SHADOW`. Used to auto-derive error
 * codes so call sites don't pass them.
 */
function upper(name: string): string {
  return name.toUpperCase();
}

/** Auto-derived error codes for the "must be a number" branch. */
function formatCode(name: string, kind = 'FORMAT'): string {
  return `INVALID_${upper(name)}_${kind}`;
}

/** Auto-derived error codes for the "out of range" branch. */
function valueCode(name: string): string {
  return formatCode(name, 'VALUE');
}

/**
 * Where a bound's authority comes from (ADR-0032). Exactly one of these belongs
 * on any validator carrying a numeric or enum bound, and each takes the
 * governing `file:line` so the claim is checkable.
 *
 * `enforced` — Godot's setter refuses or alters the value (`ERR_FAIL*`, a clamp,
 * a silently dropped write). Out of range is an ERROR.
 *
 * `hinted` — the property's `PROPERTY_HINT_RANGE` states the bound but the
 * setter assigns straight through. The hint constrains the inspector widget,
 * not the engine, so out of range is a WARNING.
 *
 * Neither is the un-audited legacy state: the bound behaves as an error and is
 * counted by `boundGrounding.test.ts`, whose ratchet only goes down.
 */
export interface Grounding {
  /**
   * `file:line` of the setter guard that refuses or alters the value. A bare
   * string grounds BOTH ends; `{ min, max }` grounds them separately, which
   * real properties need: `PhysicalBone2D.bone2d_index` has an `ERR_FAIL_COND`
   * on its floor and nothing but a hint on its ceiling.
   */
  enforced?: string | { min?: string; max?: string };
  /** `file:line` of the ADD_PROPERTY whose PROPERTY_HINT_RANGE states the bound. */
  hinted?: string | { min?: string; max?: string };
  /**
   * `file:line` of an `ERR_FAIL_COND(!is_finite(...))` in the setter.
   *
   * `inf` and `nan` are legal TSCN float literals that Godot writes and reloads
   * (`variant_parser.cpp:150-155`), so the shared numeric validator accepts
   * them. Exactly five setters in `scene/` refuse one, and each names its guard
   * here. Before this existed they were rejected everywhere by a `parseFloat`
   * accident, which was right for these five and a false positive on every
   * other float property.
   */
  finite?: string;
}

/** The citation covering one end of a bound, if the grounding names it. */
function citeFor(g: string | { min?: string; max?: string } | undefined, end: 'min' | 'max') {
  if (g === undefined) return undefined;
  return typeof g === 'string' ? g : g[end];
}

export interface FloatOpts extends Grounding {
  /** Inclusive minimum. Omit for no lower bound. */
  min?: number;
  /** Inclusive maximum. Omit for no upper bound. */
  max?: number;
  /** Custom range message override (replaces the auto-derived "must be …" text). */
  message?: string;
}

/** Same shape as `FloatOpts`; named separately for documentation symmetry. */
export type IntOpts = FloatOpts;

export interface EnumOpts extends Grounding {
  /** Per-value display labels, e.g. `{0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'}`. */
  labels: Record<number, string>;
}

const RECT2I_RE = /^Rect2i\(\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*,\s*-?\d+\s*\)$/;

/**
 * One TSCN quoted literal: a quote, an escape-aware body, a closing quote, and
 * nothing after it. The previous `".*"` only checked the first and last
 * character, so it accepted `"Head" junk "Tail"` as a single string.
 *
 * `\"` inside the value is honoured. A raw newline is accepted too — the body
 * class permits one — which costs nothing, because StrictTscnParser skips
 * multiline properties before any validator sees them.
 *
 * Measured before tightening: across the corpus (699 files, 1,971 quoted
 * values) this and `".*"` disagree on nothing, so no real scene changes verdict.
 */
const QUOTED_RE = /^"(?:[^"\\]|\\[\s\S])*"$/;
const STRING_NAME_RE = /^&?"(?:[^"\\]|\\[\s\S])*"$/;

/**
 * Tag a validator with what it accepts, for the generated `## Linting` table.
 * Exported so a slice with a bespoke validator can describe it too — an
 * untagged one renders an empty cell, which `validatorAccepts.test.ts` fails on.
 */
export function accepts(validator: PropertyValidator, description: string): PropertyValidator {
  validator.accepts = description;
  return validator;
}

/**
 * `accepts`, plus the declaration that this validator rejects nothing but
 * malformed input. Every combinator below is either a `shape` or carries a
 * `Grounding`; `boundGrounding.test.ts` fails on one that is neither, so a new
 * combinator cannot quietly start rejecting real values uncited.
 *
 * Exported for the same reason as `accepts`: a slice with a bespoke validator
 * has to classify it too.
 */
export function shape(validator: PropertyValidator, description: string): PropertyValidator {
  validator.formatOnly = true;
  return accepts(validator, description);
}

/**
 * Reject `inf` / `-inf` / `inf_neg` / `nan` ahead of the range check, for the
 * handful of setters that open with `ERR_FAIL_COND(!is_finite(...))`.
 *
 * It runs FIRST because a range check cannot express it: `Infinity > max` is
 * true so a bounded property would report the wrong reason, and every NaN
 * comparison is false so an unbounded one would report nothing at all.
 */
function withFiniteGuard(
  validator: PropertyValidator,
  name: string,
  cite: string
): PropertyValidator {
  const guarded: PropertyValidator = (key, value, line) => {
    const parsed = parseGodotFloat(value);
    if (parsed !== null && !Number.isFinite(parsed)) {
      return propertyError(
        key,
        line,
        `Property '${name}' must be finite; Godot's setter refuses "${value.trim()}"`,
        valueCode(name)
      );
    }
    return validator(key, value, line);
  };
  guarded.accepts = validator.accepts;
  // Keep BOTH citations when the property also carries a range bound, the same
  // rule `ground` follows: the finite guard and the range guard are separate
  // lines in the setter, and dropping either makes it uncheckable.
  const inner = validator.grounding?.cite;
  guarded.grounding = {
    kind: 'enforced',
    cite: inner && inner !== cite ? `${cite}, ${inner}` : cite,
  };
  return guarded;
}

/** Apply `withFiniteGuard` only when the caller named a guard. */
function maybeFinite(
  name: string,
  opts: Grounding,
  validator: PropertyValidator
): PropertyValidator {
  return opts.finite ? withFiniteGuard(validator, name, opts.finite) : validator;
}

/**
 * Severity of a bound's range branch, and the tag that records why.
 *
 * A validator is tagged with its grounding so `boundGrounding.test.ts` can
 * sweep the live registry: a bound with neither `enforced` nor `hinted` is
 * un-audited, behaves as it always has, and is counted by the ratchet.
 */
function ground(
  validator: PropertyValidator,
  opts: Grounding,
  /**
   * Whether this validator actually constrains a range. `v.float('width')` with
   * no min or max is a format check, so it needs no grounding and must not be
   * counted by the ratchet: marking every validator bounded inflated the count
   * with properties that have nothing to ground.
   */
  isBounded = true
): PropertyValidator {
  const enforced = citeFor(opts.enforced, 'min') ?? citeFor(opts.enforced, 'max');
  const hinted = citeFor(opts.hinted, 'min') ?? citeFor(opts.hinted, 'max');
  if (enforced) {
    // BOTH citations when the ends are grounded differently. Recording only the
    // enforced one discarded the hinted end's `file:line` entirely, so the
    // citation sweep could never see it and a wrong or malformed second-end
    // citation was unobservable. `extra_cull_margin` (an enforced floor and a
    // hinted ceiling) is the live shape.
    validator.grounding = {
      kind: 'enforced',
      cite: hinted && hinted !== enforced ? `${enforced}, ${hinted}` : enforced,
    };
  } else if (hinted) {
    validator.grounding = { kind: 'hinted', cite: hinted };
  }
  // An unbounded numeric combinator rejects only what is not a number, which
  // is the same class of rejection every `shape` makes.
  if (!isBounded) validator.formatOnly = true;
  return validator;
}

/**
 * Severity for one END of a bound (ADR-0032): `warning` when only a hint names
 * it, `error` when the setter does. Un-audited ends keep erroring, which is the
 * pre-split behaviour.
 */
function endSeverity(opts: Grounding, end: 'min' | 'max'): Severity {
  if (citeFor(opts.enforced, end)) return 'error';
  return citeFor(opts.hinted, end) ? 'warning' : 'error';
}

/** `float 0-1` / `float >= 0` / `integer 1-256` / `float`, from the bounds. */
function numericRange(kind: 'float' | 'integer', min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${kind} ${min}-${max}`;
  if (min !== undefined) return `${kind} >= ${min}`;
  if (max !== undefined) return `${kind} <= ${max}`;
  return kind;
}

/**
 * The declarative validator namespace. Use as `v.float`, `v.enum`, etc.
 */
export const v = {
  /**
   * Float in a range. Either bound is optional.
   * Default `min = null` (no lower bound), `max = null` (no upper bound).
   */
  float(name: string, opts: FloatOpts = {}): PropertyValidator {
    return maybeFinite(name, opts, ground(
      accepts(
        createNumericRangeValidator(
          name,
          opts.min ?? null,
          opts.max ?? null,
          false,
          opts.message,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min'),
          endSeverity(opts, 'max')
        ),
        numericRange('float', opts.min, opts.max)
      ),
      opts,
      opts.min !== undefined || opts.max !== undefined
    ));
  },

  /**
   * An angle Godot hints `radians_as_degrees`: the inspector shows degrees, the
   * `.tscn` stores radians. Give the DEGREE bounds from the hint string and this
   * converts them, so the literal in the slice matches the literal in the `.cpp`.
   *
   * The epsilon absorbs float round-trip: Godot writes `3.1415927`, and a bare
   * `<= Math.PI` comparison rejects a value the engine itself produced.
   *
   * Five slices hand-rolled this constant and three hand-wrote the message
   * before it existed, and two agents in one wave independently extracted the
   * same helper, which is what a missing combinator looks like.
   *
   * @param name - the property key.
   * @param opts - the hint's degree extents; omit `minDeg` for a one-sided
   *   range such as `"0,180,…"`.
   */
  radians(name: string, opts: { minDeg?: number; maxDeg: number } & Grounding): PropertyValidator {
    const EPSILON = 0.0001;
    const max = (opts.maxDeg * Math.PI) / 180 + EPSILON;
    const min = opts.minDeg === undefined ? 0 : (opts.minDeg * Math.PI) / 180 - EPSILON;
    const lowDeg = opts.minDeg ?? 0;
    return ground(
      accepts(
      createNumericRangeValidator(
        name,
        min,
        max,
        false,
        `Property '${name}' must be between ${min.toFixed(4)} and ${max.toFixed(4)} radians (${lowDeg} to ${opts.maxDeg} degrees)`,
        formatCode(name),
        valueCode(name),
        endSeverity(opts, 'min'),
        endSeverity(opts, 'max')
      ),
      `radians, ${lowDeg}° to ${opts.maxDeg}°`
      ),
      opts
    );
  },

  /** Float ≥ 0. Convenience alias for `v.float(name, { min: 0 })`. */
  nonNegativeFloat(name: string, opts: Grounding = {}): PropertyValidator {
    return maybeFinite(name, opts, ground(
      accepts(
        createNumericRangeValidator(
          name,
          0,
          null,
          false,
          undefined,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min')
        ),
        'float >= 0'
      ),
      opts
    ));
  },

  /** Float > 0 (strict). Useful for distances, energies, near/far planes. */
  positiveFloat(name: string, message?: string, opts: Grounding = {}): PropertyValidator {
    return ground(
      accepts(
        createNumericRangeValidator(
          name,
          Number.MIN_VALUE,
          null,
          false,
          message ?? `Property '${name}' must be greater than 0`,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min')
        ),
        'float > 0'
      ),
      opts
    );
  },

  /** Integer in a range, parsed as base 10. */
  int(name: string, opts: IntOpts = {}): PropertyValidator {
    return ground(
      accepts(
        createNumericRangeValidator(
          name,
          opts.min ?? null,
          opts.max ?? null,
          true,
          opts.message,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min'),
          endSeverity(opts, 'max')
        ),
        numericRange('integer', opts.min, opts.max)
      ),
      opts,
      opts.min !== undefined || opts.max !== undefined
    );
  },

  /** Positive integer (> 0). Specialised wrapper from `commonValidators`. */
  positiveInt(name: string, message?: string, opts: Grounding = {}): PropertyValidator {
    return ground(
      accepts(
        createPositiveIntegerValidator(
          name,
          message,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min')
        ),
        'integer > 0'
      ),
      opts
    );
  },

  /** Integer enum, e.g. `v.enumInt('cast_shadow', 0, 3, {0:'OFF', 1:'ON', 2:'DOUBLE_SIDED', 3:'SHADOWS_ONLY'})`. */
  enumInt(
    name: string,
    min: number,
    max: number,
    labels: Record<number, string>,
    opts: Grounding = {}
  ): PropertyValidator {
    // The labels are the point: `enum 0-3 (OFF/ON/DOUBLE_SIDED/SHADOWS_ONLY)`
    // tells a reader what each number means without opening Godot's docs.
    // Integer-like keys already iterate ascending, so no sort is needed.
    const names = Object.values(labels).join('/');
    return ground(
      accepts(
        createEnumValidator(
          name,
          min,
          max,
          labels,
          formatCode(name),
          valueCode(name),
          endSeverity(opts, 'min'),
          endSeverity(opts, 'max')
        ),
        `enum ${min}-${max} (${names})`
      ),
      opts
    );
  },

  /** Boolean (`'true'` | `'false'`). */
  boolean(name: string): PropertyValidator {
    return shape(createBooleanValidator(name, formatCode(name)), 'true or false');
  },

  /**
   * Accepts anything. For a property that is recognised on the node but has no
   * format Godot enforces — saying so beats leaving the sheet's Accepts column
   * blank, which reads as "nobody tagged this".
   */
  any(): PropertyValidator {
    return shape(() => null, 'any value (no format constraint)');
  },

  /** Non-empty string (anything that isn't whitespace-only). */
  string(name: string): PropertyValidator {
    return shape(createStringValidator(name, formatCode(name)), 'non-empty string');
  },

  /**
   * Quoted string `"..."` — value must begin and end with a double quote.
   * Used for properties like `Label3D.text` that take TSCN string literals.
   */
  quotedString(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!QUOTED_RE.test(value)) {
        return propertyError(key, line, `Property '${name}' must be a quoted string, got: ${value}`, code);
      }
      return null;
    }, 'quoted string');
  },

  /**
   * A `StringName` property: Godot writes `&"value"`, but the variant text
   * parser also accepts a plain `"value"`, and both appear in real scenes — so
   * `quotedString` would reject the form the engine itself saves.
   */
  stringName(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!STRING_NAME_RE.test(value)) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be a string, quoted or a StringName literal (&"…"), got: ${value}`,
          code
        );
      }
      return null;
    }, 'quoted string or &"name"');
  },

  /** `Rect2i(x, y, w, h)` integer format. */
  rect2i(name: string): PropertyValidator {
    const code = formatCode(name);
    return shape((key, value, line) => {
      if (!RECT2I_RE.test(value)) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be Rect2i(x, y, w, h) with integer components, got: ${value}`,
          code
        );
      }
      return null;
    }, 'Rect2i(x, y, w, h)');
  },

  /** `Vector2(x, y)` format. */
  vector2(name: string): PropertyValidator {
    return shape(createVector2Validator(name, formatCode(name)), 'Vector2(x, y)');
  },

  /**
   * `Vector2i(x, y)` integer format, optionally with a per-COMPONENT minimum.
   *
   * `min` rejects a value Godot's parser reads perfectly well, so it is a bound
   * like any other and takes its `Grounding`. It used to be a bare positional
   * `requireNonNegative` boolean, which put it outside `boundGrounding`'s sweep
   * entirely: `Window.size` and `SubViewport.size` both refused a negative
   * component with nothing recorded about which setter, if any, agreed.
   */
  vector2i(name: string, opts: { min?: number } & Grounding = {}): PropertyValidator {
    const { min } = opts;
    return ground(
      accepts(
        createVector2iValidator(name, min, formatCode(name), valueCode(name), endSeverity(opts, 'min')),
        min === undefined ? 'Vector2i(x, y)' : `Vector2i(x, y), both >= ${min}`
      ),
      opts,
      min !== undefined
    );
  },

  /** `Vector3(x, y, z)` format. */
  vector3(name: string): PropertyValidator {
    return shape(createVector3Validator(name, formatCode(name)), 'Vector3(x, y, z)');
  },

  /**
   * `Vector3(x, y, z)` with a per-COMPONENT numeric range.
   *
   * Godot writes a component bound as an ordinary PROPERTY_HINT_RANGE on a
   * VECTOR3 property, e.g. gpu_particles_collision_3d.cpp:101 hints `size`
   * "0.01,1024,0.01,or_greater" - meaning every component must be at least
   * 0.01, with the upper end a soft editor bound. `v.vector3` only checks the
   * literal's shape, so three slices hand-rolled the parse-and-compare loop
   * before this existed.
   *
   * Bounds are inclusive, and either may be omitted. A predicate that is not a
   * range (Camera2D's `zoom` must be non-zero, Node2D's `scale` likewise) is
   * not this, and stays hand-rolled.
   */
  boundedVector3(
    name: string,
    opts: { min?: number; max?: number } & Grounding = {}
  ): PropertyValidator {
    const { min, max } = opts;
    // Per END, not per bound. The three components share one RANGE, but the two
    // ends of that range can have different authority: GPUParticlesCollision's
    // `size` has an enforced floor and a merely hinted ceiling. Collapsing them
    // reported an ERROR for a value only the inspector hint excludes.
    const minSeverity = endSeverity(opts, 'min');
    const maxSeverity = endSeverity(opts, 'max');
    return ground(accepts((key, value, line) => {
      const match = VECTOR3_REGEX.exec(value);
      if (!match) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be Vector3 with 3 numbers like Vector3(1, 1, 1), got: "${value}"`,
          formatCode(name)
        );
      }
      const parts = [match[1], match[2], match[3]].map(tupleComponent);
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
          `Property '${name}' components must be ${bound}, got: Vector3(${parts.join(', ')})`,
          valueCode(name),
          // A component under the floor is the stronger claim when the two ends
          // disagree, so it wins.
          belowMin ? minSeverity : maxSeverity
        );
      }
      return null;
    }, `Vector3(x, y, z), each ${numericRange('float', min, max)}`), opts, min !== undefined || max !== undefined);
  },

  /** `Rect2(x, y, w, h)` format. */
  rect2(name: string): PropertyValidator {
    return shape(createRect2Validator(name, formatCode(name)), 'Rect2(x, y, w, h)');
  },

  /** `Transform3D(...12 floats)` format. */
  transform3d(name: string): PropertyValidator {
    return shape(createTransform3DValidator(name, formatCode(name)), 'Transform3D(12 floats)');
  },

  /** `SubResource("id")` or `ExtResource("id")` format. */
  resourceReference(name: string): PropertyValidator {
    return shape(
      createResourceReferenceValidator(
      name,
      `INVALID_${upper(name)}_REFERENCE`
    ),
      'SubResource("id") or ExtResource("id")'
    );
  },

  /** `NodePath("path/to/node")` format. */
  nodePath(name: string): PropertyValidator {
    return shape(
      createNodePathValidator(name, `INVALID_${upper(name)}_PATH`),
      'NodePath("path/to/node")'
    );
  },

  /**
   * `Color(r, g, b, a)` format. Built inline because the existing
   * factories don't expose a Color helper, but the regex matches
   * directionallight3d/omnilight3d/spotlight3d's hand-rolled version.
   */
  color(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Color', 4, 'Color with 4 numbers like Color(1, 1, 1, 1)', formatCode(name)),
      'Color(r, g, b, a)'
    );
  },

  /** `AABB(x, y, z, w, h, d)` format. */
  aabb(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'AABB', 6, 'AABB with 6 numbers like AABB(0, 0, 0, 1, 1, 1)', formatCode(name)),
      'AABB(x, y, z, w, h, d)'
    );
  },

  /** `Quaternion(x, y, z, w)` format. */
  quaternion(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Quaternion', 4, 'Quaternion with 4 numbers like Quaternion(0, 0, 0, 1)', formatCode(name)),
      'Quaternion(x, y, z, w)'
    );
  },

  /** `Transform2D(6 floats)` format. */
  transform2d(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Transform2D', 6, 'Transform2D with 6 numbers like Transform2D(1, 0, 0, 1, 0, 0)', formatCode(name)),
      'Transform2D(6 floats)'
    );
  },

  /**
   * Lenient integer — `parseInt(value, 10)` accepts trailing decimals
   * ("10.5" → 10). Used for properties like Camera2D's `limit_*` where
   * the upstream Godot parser is tolerant. The "must be a number" /
   * "must be an integer" wording follows the per-node test wording.
   */
  lenientInt(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    return shape(
      (key, value, line) => {
      const parsed = parseInt(value, 10);
      if (isNaN(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      return null;
    },
      'integer'
    );
  },

  /**
   * Strict integer — rejects floats that round to an integer (uses
   * `Number.isInteger(parseFloat(value))` to disambiguate "5.5" from "5").
   * Use this when the property is a discrete index/count, not a number
   * that happens to be whole-valued.
   */
  strictInt(name: string, opts: IntOpts = {}): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const { min, max } = opts;
    return ground(accepts((key, value, line) => {
      const parsed = parseFloat(value);
      if (isNaN(parsed) || !Number.isInteger(parsed)) {
        return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
      }
      const belowMin = min !== undefined && parsed < min;
      const aboveMax = max !== undefined && parsed > max;
      if (belowMin || aboveMax) {
        return propertyError(
          key,
          line,
          opts.message ?? `Property '${name}' must be ${numericRange('integer', min, max)} (got ${parsed})`,
          valueErr,
          endSeverity(opts, belowMin ? 'min' : 'max')
        );
      }
      return null;
    }, numericRange('integer', min, max)), opts, min !== undefined || max !== undefined);
  },

  /**
   * Strict non-negative integer: same format check as `strictInt`, plus
   * `value >= 0`. Used for frame indices and similar count-style
   * properties where `"5.5"` is a format error and `-1` is a value error.
   */
  strictNonNegativeInt(name: string, opts: Grounding = {}): PropertyValidator {
    const formatErr = formatCode(name);
    const valueErr = valueCode(name);
    const severity = endSeverity(opts, 'min');
    return ground(
      accepts(
        (key, value, line) => {
          const parsed = parseFloat(value);
          if (isNaN(parsed) || !Number.isInteger(parsed)) {
            return propertyError(key, line, `Property '${name}' must be an integer, got: "${value}"`, formatErr);
          }
          if (parsed < 0) {
            return propertyError(key, line, `Property '${name}' must be non-negative (got ${parsed})`, valueErr, severity);
          }
          return null;
        },
        'integer >= 0'
      ),
      opts
    );
  },

  /** `Basis(9 floats)` format. */
  basis(name: string): PropertyValidator {
    return shape(
      floatTupleValidator(name, 'Basis', 9, 'Basis with 9 numbers like Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)', formatCode(name)),
      'Basis(9 floats)'
    );
  },

  /**
   * `PackedVector2Array(x, y, x, y, …)`, an arbitrary-length list of coordinate PAIRS.
   *
   * Not built on `floatTupleValidator`, which pins an exact arity. The interesting
   * failure here is the one arity cannot express: an ODD number of values, meaning a
   * truncated final vertex. That is a value error rather than a format error, because
   * the grammar parsed fine and the content is wrong.
   *
   * Godot serialises an empty array as `PackedVector2Array()`, so zero values is legal.
   * Godot writes signed, scientific (`4.37114e-08`), whitespace-padded and
   * non-finite (`inf` / `inf_neg` / `nan`) numbers.
   *
   * Implemented standalone rather than reusing `parsePackedVector2Array` from the
   * resources layer: that helper throws on bad input instead of returning a ParseError,
   * and does not check pair parity at all.
   */
  packedVector2Array(name: string): PropertyValidator {
    const formatErr = formatCode(name);
    const WRAPPER = /^\s*PackedVector2Array\s*\(([\s\S]*)\)\s*$/;
    return shape(
      (key, value, line) => {
      const match = WRAPPER.exec(value);
      if (!match) {
        return propertyError(
          key,
          line,
          `Property '${name}' must be a PackedVector2Array like PackedVector2Array(0, 0, 1, 0), got: ${value}`,
          formatErr
        );
      }
      const body = match[1]!.trim();
      if (body === '') return null;

      const parts = body.split(',');
      for (const part of parts) {
        // The component GRAMMAR, not a numeric parse: `Number()` refuses `inf`,
        // which `rtos_fix` writes into these arrays too (variant_parser.cpp:2504),
        // while `parseFloat` would accept the trailing garbage in `1abc` that
        // Godot's tokenizer stops at.
        if (!TSCN_FLOAT_RE.test(part.trim())) {
          return propertyError(
            key,
            line,
            `Property '${name}' contains a non-numeric value: "${part.trim()}"`,
            formatErr
          );
        }
      }
      // An ODD count is NOT rejected. VariantParser builds the array with
      // `int len = args.size() / 2` (variant_parser.cpp:1555), integer division,
      // so a trailing lone coordinate is silently dropped and the scene loads.
      // Rejecting it refused a file Godot reads.
      return null;
    },
      'PackedVector2Array(x, y, …)'
    );
  },
};
