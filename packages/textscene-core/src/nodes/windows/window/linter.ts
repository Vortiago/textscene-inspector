/**
 * Window's cross-field rules: a `max_size` below `min_size`, a `size` those limits clamp,
 * and a `content_scale_factor` that integer stretch floors. Each reads two or three keys
 * off one node, so none fits a single-key validator. Format checks live in linterParser.ts.
 */

import { scalarSlotValue } from '../../../godot/variant/variantBool.js';
import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { matchVector2i } from '../../../linter/validators/index.js';
import { ruleInt } from '../../../godot/variant/intSlots.js';
import { descendsFromClass } from '../../../godot/classdb/classBaseTypes.js';
import { formatReal, storedReal } from '../../../godot/math/real.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../linter/ruleArms.js';
import type { Vector2 } from '../../../godot/math/vector.js';
import {
  clampLimitSize,
  ContentScaleStretch,
  isWindowSizeKey,
  replayWindowSize,
  isMaxSizeSet,
  validMaxSize,
  windowClassDefaults,
  type WindowSizeWrite,
} from '../../../godot/scene/window.js';

const arms = {
  maxSizeBelowMinSize: groundedArm('window-max-size-below-min-size', {
    kind: 'engine-inert',
    at: 'window.cpp:473',
    unused: 'the size fails this validity test, so the rendering server maximum is used instead',
  }),
  sizeClampedByLimits: {
    severity: 'warning',
    ruleName: 'window-size-clamped-by-limits',
    grounding: { kind: 'engine', at: 'window.cpp:1190-1196' },
  },
  contentScaleFactorFloored: {
    severity: 'warning',
    ruleName: 'window-content-scale-factor-floored',
    grounding: { kind: 'engine', at: 'window.cpp:1240-1247' },
  },
} as const satisfies RuleArms<string>;

const formatSize = (size: Vector2): string => `Vector2i(${size.x}, ${size.y})`;
const sameSize = (a: Vector2, b: Vector2): boolean => a.x === b.x && a.y === b.y;

function checkMaxBelowMin(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  if (rawProps.max_size === undefined) return [];

  const maxSize = matchVector2i(rawProps.max_size);
  const minSize =
    rawProps.min_size === undefined
      ? windowClassDefaults(node.type).minSize
      : matchVector2i(rawProps.min_size);
  if (!maxSize || !minSize) return [];

  // Both setters floor a negative component at 0 (`_clamp_limit_size`, :461-469) before
  // the validity test runs. One failing axis invalidates the whole max_size, and Godot uses
  // the rendering server's maximum: `Vector2i(0, 1080)` under `Vector2i(400, 300)` has no
  // maximum at all, not a capped height.
  const limits = { minSize: clampLimitSize(minSize), maxSize: clampLimitSize(maxSize) };
  if (!isMaxSizeSet(limits.maxSize) || validMaxSize(limits)) return [];
  return [
    armDiagnostic(
      arms.maxSizeBelowMinSize,
      node,
      `Window 'max_size' (${formatSize(maxSize)}) is smaller than 'min_size' (${formatSize(minSize)}) in at least one dimension. Godot ignores max_size entirely in this case.`
    ),
  ];
}

/**
 * The file's `size` and the one Godot holds after it applies the `size`, `min_size` and
 * `max_size` lines in order, or `null` when `size` is absent or one of them holds no int32.
 * The `wrap_controls` floor is not modelled: it needs the solved Controls.
 */
function replaySize(
  rawProps: Record<string, string>,
  constructorMin: Vector2
): { written: Vector2; loaded: Vector2 } | null {
  const writes: WindowSizeWrite[] = [{ key: 'min_size', value: constructorMin }];
  let written: Vector2 | null = null;
  for (const [key, raw] of Object.entries(rawProps)) {
    if (!isWindowSizeKey(key)) continue;
    const value = matchVector2i(raw);
    if (!value) return null;
    if (key === 'size') written = value;
    writes.push({ key, value });
  }
  return written ? { written, loaded: replayWindowSize(writes) } : null;
}

function checkSizeClamped(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  const constructorMin = windowClassDefaults(node.type).minSize;
  const hasConstructorMin = constructorMin.x > 0 || constructorMin.y > 0;
  if (rawProps.min_size === undefined && rawProps.max_size === undefined && !hasConstructorMin) return [];
  const replayed = replaySize(rawProps, constructorMin);
  if (!replayed) return [];
  const { written, loaded } = replayed;
  // A negative component is the validator's error on this same clamp, so the floor at 0
  // is not reported twice.
  if (sameSize(loaded, clampLimitSize(written))) return [];
  return [
    armDiagnostic(
      arms.sizeClampedByLimits,
      node,
      `Window 'size' ${formatSize(written)} loads as ${formatSize(loaded)}: Godot raises it to 'min_size' and caps it at a valid 'max_size', one line at a time in the order the file lists them.`
    ),
  ];
}

function checkContentScaleFloored(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  if (rawProps.content_scale_factor === undefined) return [];
  if (ruleInt(rawProps.content_scale_stretch, ContentScaleStretch.FRACTIONAL) !== ContentScaleStretch.INTEGER)
    return [];
  const written = scalarSlotValue(rawProps.content_scale_factor);
  // At or below 0 the setter refuses the value (window.cpp:1774), which the validator
  // reports. The floor leaves nan and inf as they are.
  if (written === null || !Number.isFinite(written) || written <= 0) return [];
  const stored = storedReal(written);
  const loaded = Math.max(Math.floor(stored), 1);
  if (loaded === stored) return [];
  return [
    armDiagnostic(
      arms.contentScaleFactorFloored,
      node,
      `Window 'content_scale_factor' ${formatReal(stored)} loads as ${loaded}: 'content_scale_stretch' INTEGER (1) floors it to a whole number of at least 1.`
    ),
  ];
}

function checkWindow(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.rawProperties;
  return [
    ...checkMaxBelowMin(node, rawProps),
    ...checkSizeClamped(node, rawProps),
    ...checkContentScaleFloored(node, rawProps),
  ];
}

const windowValidationRule: LintRule = {
  meta: {
    name: 'valid-window-properties',
    description: "Validates Window's size, size limits and content scale factor against each other",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFromClass(nodeType, 'Window'),
    emits: armEmits(arms),
  },
  check: checkWindow,
};

ruleRegistry.register(windowValidationRule);
