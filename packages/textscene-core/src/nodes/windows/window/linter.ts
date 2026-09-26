/**
 * Window's cross-field rules: a `max_size` below `min_size`, a `size` those limits clamp,
 * and a `content_scale_factor` that integer stretch floors. Each reads two or three keys
 * off one node, so none fits a single-key validator. Format checks live in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { matchVector2i } from '../../../linter/validators/index.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { parseGodotFloat } from '../../../godot/number.js';
import { formatReal, storedReal } from '../../../godot/real.js';
import type { Vector2 as Size } from '../../../parser/vectors.js';

/** window.h:105,126: `size = Size2i(DEFAULT_WINDOW_SIZE, DEFAULT_WINDOW_SIZE)`, 100. */
const DEFAULT_SIZE: Size = { x: 100, y: 100 };
/** window.h:88-89, enum ContentScaleStretch. */
const CONTENT_SCALE_STRETCH_INTEGER = 1;

const formatSize = (size: Size): string => `Vector2i(${size.x}, ${size.y})`;
const sameSize = (a: Size, b: Size): boolean => a.x === b.x && a.y === b.y;
const floorAtZero = (size: Size): Size => ({ x: Math.max(size.x, 0), y: Math.max(size.y, 0) });

function checkMaxBelowMin(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  if (rawProps.max_size === undefined || rawProps.min_size === undefined) return [];

  const maxSize = matchVector2i(rawProps.max_size);
  const minSize = matchVector2i(rawProps.min_size);
  if (!maxSize || !minSize) return [];

  // `_clamp_limit_size` (:461) floors a negative component at 0, so `!== 0` agrees
  // with Godot's `> 0` in `_validate_limit_size` (scene/main/window.cpp:473).
  const maxSizeSet = maxSize.x !== 0 || maxSize.y !== 0;
  // One failing axis invalidates the whole max_size, and Godot uses the rendering
  // server's maximum: `Vector2i(0, 1080)` under `Vector2i(400, 300)` has no maximum at
  // all, not a capped height. So this checks each component.
  if (!maxSizeSet || (maxSize.x >= minSize.x && maxSize.y >= minSize.y)) return [];
  return [
    {
      severity: 'info',
      message: `Window 'max_size' (${formatSize(maxSize)}) is smaller than 'min_size' (${formatSize(minSize)}) in at least one dimension. Godot ignores max_size entirely in this case.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'window-max-size-below-min-size',
    },
  ];
}

/**
 * `max_size` while `_validate_limit_size` (window.cpp:471-475) accepts it, else `null`. A
 * `null` limit is the rendering server's maximum, which this file cannot state, so it never caps.
 */
function validMaxSize(minSize: Size, maxSize: Size | null): Size | null {
  if (maxSize === null || (maxSize.x <= 0 && maxSize.y <= 0)) return null;
  return maxSize.x >= minSize.x && maxSize.y >= minSize.y ? maxSize : null;
}

/** `_update_window_size`'s clamp (window.cpp:1190-1196). */
function clampSize(size: Size, minSize: Size, maxSize: Size | null): Size {
  const floored = { x: Math.max(size.x, minSize.x), y: Math.max(size.y, minSize.y) };
  const cap = validMaxSize(minSize, maxSize);
  return cap ? { x: Math.min(floored.x, cap.x), y: Math.min(floored.y, cap.y) } : floored;
}

/**
 * The file's `size` and the one Godot holds after it applies the `size`, `min_size` and
 * `max_size` lines in order, or `null` when one of them holds no int32. Each setter runs
 * `_update_window_size` (window.cpp:1183-1229), and its clamp overwrites `size`, so an
 * early cap stands under a later floor. The `wrap_controls` floor is not modelled.
 */
function replaySize(rawProps: Record<string, string>): { written: Size; loaded: Size } | null {
  let written = DEFAULT_SIZE;
  let size = DEFAULT_SIZE;
  let minSize: Size = { x: 0, y: 0 };
  let maxSize: Size | null = null;

  for (const [key, raw] of Object.entries(rawProps)) {
    if (key !== 'size' && key !== 'min_size' && key !== 'max_size') continue;
    const value = matchVector2i(raw);
    if (!value) return null;
    if (key === 'size') {
      written = value;
      size = clampSize(value, minSize, maxSize);
      continue;
    }
    // `set_min_size` and `set_max_size` (window.cpp:477-515) return early on an unchanged
    // limit, after `_clamp_limit_size` (:461-469) floors it at 0.
    const limit = floorAtZero(value);
    const current = key === 'min_size' ? minSize : maxSize;
    if (current && sameSize(current, limit)) continue;
    if (key === 'min_size') minSize = limit;
    else maxSize = limit;
    size = clampSize(size, minSize, maxSize);
  }
  return { written, loaded: size };
}

function checkSizeClamped(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  if (rawProps.size === undefined) return [];
  if (rawProps.min_size === undefined && rawProps.max_size === undefined) return [];
  const replayed = replaySize(rawProps);
  if (!replayed) return [];
  const { written, loaded } = replayed;
  // A negative component is the validator's error on this same clamp, so the floor at 0
  // is not reported twice.
  if (sameSize(loaded, floorAtZero(written))) return [];
  return [
    {
      severity: 'warning',
      message: `Window 'size' ${formatSize(written)} loads as ${formatSize(loaded)}: Godot raises it to 'min_size' and caps it at a valid 'max_size', one line at a time in the order the file lists them.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'window-size-clamped-by-limits',
    },
  ];
}

function checkContentScaleFloored(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  if (rawProps.content_scale_factor === undefined) return [];
  if (ruleInt(rawProps.content_scale_stretch, 0) !== CONTENT_SCALE_STRETCH_INTEGER) return [];
  const written = parseGodotFloat(rawProps.content_scale_factor);
  // At or below 0 the setter refuses the value (window.cpp:1774), which the validator
  // reports. The floor leaves nan and inf as they are.
  if (written === null || !Number.isFinite(written) || written <= 0) return [];
  const stored = storedReal(written);
  const loaded = Math.max(Math.floor(stored), 1);
  if (loaded === stored) return [];
  return [
    {
      severity: 'warning',
      message: `Window 'content_scale_factor' ${formatReal(stored)} loads as ${loaded}: 'content_scale_stretch' INTEGER (1) floors it to a whole number of at least 1.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'window-content-scale-factor-floored',
    },
  ];
}

function checkWindow(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.properties;
  if (!isValidProperties(rawProps)) return [];
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
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Window'),
    emits: [
      {
        ruleName: 'window-max-size-below-min-size',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'window.cpp:473',
          unused: 'the size fails this validity test, so the rendering server maximum is used instead',
        },
      },
      {
        ruleName: 'window-size-clamped-by-limits',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'window.cpp:1190-1196' },
      },
      {
        ruleName: 'window-content-scale-factor-floored',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'window.cpp:1240-1247' },
      },
    ],
  },
  check: checkWindow,
};

ruleRegistry.register(windowValidationRule);

export { windowValidationRule };
