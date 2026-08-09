/**
 * Semantic linter rules for the base Control slice.
 *
 * `SceneState::instantiate` applies a node's properties in the ORDER the `.tscn`
 * lists them, while the node is still an orphan (`scene/resources/packed_scene.cpp`:
 * the `node->set(...)` loop runs before the `_add_child_nocheck` that parents it).
 * `Control::_set_anchors_layout_preset` (`scene/gui/control.cpp:982-1032`) is a
 * setter with THREE sibling side effects — it calls `set_anchors_preset`,
 * `set_offsets_preset`, and `set_grow_direction_preset` in turn — so an
 * `anchor_*`/`offset_*`/`grow_*` line already applied BEFORE `anchors_preset` in
 * the file is silently overwritten by it. The setter itself is also gated: it
 * no-ops unless `layout_mode` has ALREADY been applied as `1` (Anchors) or `3`
 * (Uncontrolled) (`control.cpp:991-993`), so an `anchors_preset` line that
 * precedes `layout_mode` in the file does nothing at all.
 *
 * `TscnNode.properties` for the strict parser (`StrictTscnParser.createSimpleNode`)
 * is the raw `Record<string, string>` `TscnParserCore` built by assigning each
 * property key exactly once, in scan order — plain-object key iteration reflects
 * insertion order for non-numeric string keys (every key on a Control node
 * qualifies), so `Object.keys(node.properties)` already IS the file order this
 * rule needs, with no parser change.
 *
 * This warning names an AUTHORING hazard, not a rendering gap: the renderer
 * itself now resolves this order correctly (`r3f/controls/controlAnchors.ts`'s
 * `resolveControlLayout`, ADR-0035, Option B) by replaying a node's raw
 * property keys in file order — so a scene that authors the divergent order
 * still previews exactly as Godot would render it. The warning stays because
 * the ORDER remains confusing to a human maintaining the file even once the
 * math is right — a later `anchors_preset` silently discarding an earlier
 * `offset_*` is a footgun worth flagging regardless of whether this
 * previewer gets the resulting rect right. Nothing in the fixture corpus
 * authors the divergent order today, and an editor-saved scene cannot
 * (`_get_anchors_layout_preset` derives the preset FROM the final anchors, so
 * a non-zero preset and matching `anchor_*` always co-occur) — but a
 * hand-authored or hand-edited `.tscn` carries no such guarantee.
 *
 * The "N sibling keys wiped by one trigger key" arithmetic below is shared with
 * `HSlider`/`VSlider`'s own property-order rules (`shared/rangeLinter.ts`,
 * `linter/propertyOrder.ts`) — Godot's `Range` has the identical setter shape
 * for `value` vs `min_value`/`max_value`/`page`. This file's own GATE check
 * (`layout_mode` vs `anchors_preset`, below) has no Range equivalent, so it
 * stays bespoke here rather than folding into the shared helper.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { NODE_BASE_TYPES } from '../../../../linter/nodeBaseTypes.js';
import { targetsBeforeLatestTrigger } from '../../../../linter/propertyOrder.js';

/**
 * The `anchor_*`/`offset_*`/`grow_*` keys `_set_anchors_layout_preset` overwrites
 * as a side effect — `set_anchors_preset` (anchors), `set_offsets_preset`
 * (offsets), `set_grow_direction_preset` (grow) — the same ten keys
 * `controlAnchors.ts`'s `resolveControlLayout` (file-order-aware) and its
 * `resolveAnchors`/`resolveOffsets`/`resolveGrowDirection` fallbacks read.
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
 * `_set_anchors_layout_preset` returns immediately on `-1` — the custom-anchors
 * sentinel — before touching anything (`control.cpp:983-989`), and on anything
 * outside `0..15` (`ERR_FAIL_INDEX`). Neither case wipes or no-ops a sibling
 * property, so this rule has nothing to say about them.
 */
function isMeaningfulPreset(rawPreset: string | undefined): boolean {
  if (rawPreset === undefined) return false;
  const n = Number(rawPreset);
  return Number.isInteger(n) && n >= 0 && n <= 15;
}

function checkControlPropertyOrder(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.properties as Record<string, string>;

  if (!isMeaningfulPreset(props.anchors_preset)) return [];

  const keys = Object.keys(props);
  const presetIndex = keys.indexOf('anchors_preset');

  if (!presetIsOperational(props.layout_mode)) {
    // The preset is either unconditionally inert (no `layout_mode` at all —
    // Godot's struct default, LAYOUT_MODE_POSITION, never opens the gate) or
    // depends on an ordering fact the branch below already covers. Either way
    // nothing was WIPED by a preset that never ran, so stay silent rather than
    // flag an authoring choice that has no effect either way.
    return [];
  }

  const layoutModeIndex = keys.indexOf('layout_mode');

  // Mutually exclusive with the wipe check below: if `layout_mode` is authored
  // AFTER `anchors_preset`, the preset's setter ran while `stored_layout_mode`
  // was still its default and did nothing at all — so nothing downstream of it
  // was wiped either.
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

const controlPropertyOrderRule: LintRule = {
  meta: {
    name: 'control-property-order',
    description:
      "Warns when a Control-family node authors anchor_*/offset_*/grow_* or layout_mode in a file " +
      "order Godot's own anchors_preset setter silently discards or no-ops.",
    category: 'validation',
    applicableNodeTypeMatcher: (nodeType) =>
      nodeType === 'Control' || NODE_BASE_TYPES[nodeType] === 'Control',
    emits: [{ ruleName: 'control-property-order', severity: 'warning' }],
  },
  check: checkControlPropertyOrder,
};

ruleRegistry.register(controlPropertyOrderRule);

export { controlPropertyOrderRule };
