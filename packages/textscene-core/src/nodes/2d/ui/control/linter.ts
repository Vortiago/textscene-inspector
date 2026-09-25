/**
 * Semantic rules for the base Control slice: the file-order hazard of `anchors_preset`,
 * and the tooltip warning of `Control::get_configuration_warnings()` (control.cpp:246-256).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { unquoteString } from '../../../../parser/utils.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { targetsBeforeLatestTrigger } from '../../../../linter/propertyOrder.js';

/**
 * The keys `_set_anchors_layout_preset` (`scene/gui/control.cpp:982-1032`) overwrites through
 * `set_anchors_preset`, `set_offsets_preset` and `set_grow_direction_preset`: the ten keys
 * `resolveControlLayout` in `controlAnchors.ts` reads.
 */
const PRESET_SIDE_EFFECT_KEYS = [
  'anchor_left',
  'anchor_top',
  'anchor_right',
  'anchor_bottom',
  'offset_left',
  'offset_top',
  'offset_right',
  'offset_bottom',
  'grow_horizontal',
  'grow_vertical',
] as const;

/** `Control::LayoutMode` values that leave `anchors_preset` operational (`control.cpp:991`). */
function presetIsOperational(layoutMode: string | undefined): boolean {
  return layoutMode === '1' || layoutMode === '3';
}

/**
 * `_set_anchors_layout_preset` returns at once on the custom-anchors value `-1`
 * (`control.cpp:983-989`) and on a value outside `0..15` (`ERR_FAIL_INDEX`), so
 * neither touches a sibling.
 */
function isMeaningfulPreset(rawPreset: string | undefined): boolean {
  if (rawPreset === undefined) return false;
  const n = Number(rawPreset);
  return Number.isInteger(n) && n >= 0 && n <= 15;
}

/**
 * `SceneState::instantiate` applies properties in file order, before it parents the node
 * (`scene/resources/packed_scene.cpp`). So `anchors_preset` overwrites an earlier `anchor_*`,
 * `offset_*` or `grow_*` line, and does nothing unless `layout_mode` 1 or 3 came first
 * (`control.cpp:991-993`).
 */
function checkControlPropertyOrder(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.properties as Record<string, string>;

  if (!isMeaningfulPreset(props.anchors_preset)) return [];

  // The strict parser assigns each key once, in scan order, and no Control key is
  // numeric, so `Object.keys` is the file order.
  const keys = Object.keys(props);
  const presetIndex = keys.indexOf('anchors_preset');

  if (!presetIsOperational(props.layout_mode)) {
    // A preset that never runs wipes nothing. The default LAYOUT_MODE_POSITION keeps the gate shut.
    return [];
  }

  // This `layout_mode` gate has no Range twin, so it stays here, outside `linter/propertyOrder.ts`.
  const layoutModeIndex = keys.indexOf('layout_mode');

  // A later `layout_mode` means the preset ran at the default layout mode and did
  // nothing, so the wipe check below does not apply.
  if (layoutModeIndex > presetIndex) {
    return [
      {
        severity: 'warning',
        message:
          `'layout_mode' is authored after 'anchors_preset' on ${node.name}. Godot applies a ` +
          `node's properties in the order the file lists them (SceneState::instantiate, ` +
          `scene/resources/packed_scene.cpp), so 'anchors_preset' ran while 'layout_mode' was ` +
          `still its default (Position) and had no effect at all — the anchors/offsets/grow ` +
          `direction stayed whatever they were before this line. Move 'layout_mode' before ` +
          `'anchors_preset'.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'control-property-order',
      },
    ];
  }

  // The renderer replays this order (`resolveControlLayout`, ADR-0035), so the warning names
  // an authoring hazard. An editor-saved scene cannot have it: the editor derives the preset
  // from the final anchors. The wipe check is shared with Range (`linter/propertyOrder.ts`).
  const wiped = targetsBeforeLatestTrigger(props, PRESET_SIDE_EFFECT_KEYS, ['anchors_preset']);

  if (wiped.length === 0) return [];

  return [
    {
      severity: 'warning',
      message:
        `${wiped.join(', ')} ${wiped.length > 1 ? 'are' : 'is'} authored before 'anchors_preset' ` +
        `on ${node.name}. Godot applies a node's properties in the order the file lists them ` +
        `(SceneState::instantiate, scene/resources/packed_scene.cpp), and ` +
        `'anchors_preset''s setter overwrites ${wiped.length > 1 ? 'these' : 'this'} as a side ` +
        `effect (Control::_set_anchors_layout_preset, scene/gui/control.cpp) — so the authored ` +
        `value${wiped.length > 1 ? 's are' : ' is'} silently discarded at load. Move ` +
        `${wiped.length > 1 ? 'them' : 'it'} after 'anchors_preset', or drop 'anchors_preset' if ` +
        `the explicit value${wiped.length > 1 ? 's are' : ' is'} what should apply.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'control-property-order',
    },
  ];
}

// control.h:89-91: MouseFilter { STOP, PASS, IGNORE }.
const MOUSE_FILTER_IGNORE = 2;

/**
 * The constructors that set their own `mouse_filter` to IGNORE: `Label` (label.cpp:1477) and
 * `NinePatchRect` (nine_patch_rect.cpp:191). Control's default is STOP (control.h:237), and every
 * other constructor sets STOP or PASS, as Container does (container.cpp:233).
 */
const MOUSE_FILTER_IGNORE_BY_DEFAULT = new Set(['Label', 'NinePatchRect']);

// Godot tests `data.mouse_filter == MOUSE_FILTER_IGNORE`, not `get_mouse_filter_with_override()`:
// PASS warns no more than STOP, and no ancestor's filter counts.
function resolvedMouseFilterIsIgnore(node: { type: string; properties: unknown }): boolean {
  const props = isValidProperties(node.properties) ? node.properties : {};
  const raw = props.mouse_filter;
  if (raw !== undefined) {
    return ruleInt(raw) === MOUSE_FILTER_IGNORE;
  }
  return MOUSE_FILTER_IGNORE_BY_DEFAULT.has(node.type);
}

function checkControlTooltip(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = isValidProperties(node.properties) ? node.properties : {};

  const tooltip = props.tooltip_text;
  if (tooltip === undefined) return [];
  // Godot tests String::is_empty(), so an empty literal means no tooltip, as an absent key does.
  if (unquoteString(tooltip) === '') return [];

  if (!resolvedMouseFilterIsIgnore(node)) return [];

  return [
    {
      severity: 'warning',
      message: `${node.type} '${node.name}' sets 'tooltip_text' but its Mouse Filter resolves to Ignore, so the tooltip will never be displayed. Set Mouse Filter to Stop or Pass instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'control-tooltip-ignored-by-mouse-filter',
    },
  ];
}

/**
 * One rule with two reports: `ruleCoverage.emits.test.ts` gives every `ruleName`
 * in a slice's `linter.ts` to every rule declared there, which is sound only for one rule.
 */
const controlRule: LintRule = {
  meta: {
    name: 'valid-control-properties',
    description:
      'Flags a tooltip that can never be displayed because the control resolves Mouse Filter to ' +
      'Ignore, and an anchor/offset/layout_mode file order the anchors_preset setter discards.',
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) => descendsFrom(nodeType, 'Control'),
    emits: [
      {
        ruleName: 'control-tooltip-ignored-by-mouse-filter',
        severity: 'warning',
        grounding: { kind: 'configuration-warning' },
      },
      {
        ruleName: 'control-property-order',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'control.cpp:991' },
      },
    ],
  },
  check: (context) => [...checkControlTooltip(context), ...checkControlPropertyOrder(context)],
};

ruleRegistry.register(controlRule);

export { controlRule };
