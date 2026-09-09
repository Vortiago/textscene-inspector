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
 *
 * Semantic linter rule for Control — `Control::get_configuration_warnings()`
 * (control.cpp:246-256):
 *
 *     PackedStringArray warnings = CanvasItem::get_configuration_warnings();
 *     if (data.mouse_filter == MOUSE_FILTER_IGNORE && !data.tooltip.is_empty()) {
 *         warnings.push_back(RTR("The Hint Tooltip won't be displayed as the
 *             control's Mouse Filter is set to \"Ignore\". To solve this, set
 *             the Mouse Filter to \"Stop\" or \"Pass\"."));
 *     }
 *     return warnings;
 *
 * The guard tests EQUALITY with IGNORE (control.h:89-91: STOP=0, PASS=1,
 * IGNORE=2), not inequality with STOP — so a resolved default of PASS behaves
 * exactly like STOP here: neither is IGNORE, so neither warns. It also reads
 * `data.mouse_filter` directly, never `get_mouse_filter_with_override()`, so no
 * ancestor's filter enters into it — only this node's own value.
 *
 * `mouse_filter`'s own default is NOT uniform across Control, which is why
 * absence cannot simply be read as "not IGNORE". Control's field initialiser is
 * STOP (control.h:237), but two subclasses override it to IGNORE in their own
 * constructor: `Label::Label()` (label.cpp:1477) and
 * `NinePatchRect::NinePatchRect()` (nine_patch_rect.cpp:191). A full sweep of
 * every bare (self, not a child node's) `set_mouse_filter(MOUSE_FILTER_*)` call
 * across `scene/` and `modules/` finds exactly thirteen: Container overrides to
 * PASS (container.cpp:233, irrelevant here since PASS != IGNORE either way),
 * ten more re-affirm STOP or override to PASS on their own subtree (Button,
 * LineEdit, GraphFrame, FoldableContainer, Panel, GraphNode, PanelContainer,
 * TextureRect, TextureProgressBar, Tree — none IGNORE), and only Label and
 * NinePatchRect land on IGNORE. So those two are the complete set.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../../linter/linterUtils.js';
import { descendsFrom } from '../../../../godot/nodeBaseTypes.js';
import { unquoteString } from '../../../../parser/utils.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
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

// control.h:89-91: MouseFilter { STOP, PASS, IGNORE }.
const MOUSE_FILTER_IGNORE = 2;

/** Constructors that set their OWN default `mouse_filter` to IGNORE, rather than inheriting Control's STOP. */
const MOUSE_FILTER_IGNORE_BY_DEFAULT = new Set(['Label', 'NinePatchRect']);

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
  // Godot compares String::is_empty(); an authored empty-string literal means
  // "no tooltip" the same way an absent key does.
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
 * ONE rule for the Control slice, two reports — `ruleCoverage.emits.test.ts`
 * attributes every scraped `ruleName` in a slice's `linter.ts` to every rule
 * declared there, which is sound only while that is one rule.
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
