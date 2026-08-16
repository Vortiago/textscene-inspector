/**
 * Semantic linter rules for OpenXRRenderModelManager, from Godot's own
 * configuration warnings,
 * `OpenXRRenderModelManager::get_configuration_warnings()`
 * (openxr_render_model_manager.cpp:199-226):
 *
 *     XROrigin3D *parent = nullptr;
 *     if (tracker == 0 || tracker == 1) {
 *         if (!make_local_to_pose.is_empty()) {
 *             warnings.push_back("Must specify a tracker to make node local to pose.");
 *         }
 *         parent = Object::cast_to<XROrigin3D>(get_parent());
 *     } else {
 *         Node *node = get_parent();
 *         while (!parent && node) {
 *             parent = Object::cast_to<XROrigin3D>(node);
 *             node = node->get_parent();
 *         }
 *     }
 *     if (!parent) {
 *         warnings.push_back("This node must be a child of an XROrigin3D node!");
 *     }
 *
 *     if (!GLOBAL_GET("xr/openxr/extensions/render_model")) {
 *         warnings.push_back("The render model extension is not enabled in project settings!");
 *     }
 *
 * The third warning reads a PROJECT SETTING
 * (`xr/openxr/extensions/render_model`) no `.tscn` carries — runtime-only,
 * declined.
 *
 * The first two share one `tracker`-gated branch, and both are checkable from
 * the file alone:
 *
 *  - `tracker` ANY(0) or NONE_SET(1) (0 is also `tracker`'s own default, so
 *    an absent key means this branch): only the DIRECT parent is cast, and
 *    `make_local_to_pose` being set here is a real, reachable authoring
 *    state, not the serialised default — the default IS the empty string,
 *    and the trigger is a NON-empty value while the tracker stays
 *    unspecific. A file can hit this by setting `make_local_to_pose` alone
 *    and never touching `tracker` at all.
 *  - `tracker` LEFT_HAND(2) or RIGHT_HAND(3): every ANCESTOR up to the scene
 *    root is checked, not just the immediate parent.
 *
 * The ancestor search reuses `parentTypeVerdict` at each step rather than
 * hand-rolling its instanced/untyped exemption a second time: a `mismatch`
 * just climbs one level higher, and `satisfied` / `unknowable` / `root`
 * (chain exhausted without a match) end the walk.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { parentTypeVerdict, type ParentVerdict } from '../../../../linter/parentType.js';
import type { TscnNode, TscnScene } from '../../../../parser/types.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';

const TRACKER_RULE = 'openxrrendermodelmanager-tracker-required-for-local-pose';
const PARENT_RULE = 'openxrrendermodelmanager-parent-not-xrorigin3d';

/** The two `tracker` values that search only the DIRECT parent (cpp:203). */
const RENDER_MODEL_TRACKER_ANY = 0;
const RENDER_MODEL_TRACKER_NONE_SET = 1;

/** `tracker`'s own default (openxr_render_model_manager.h:68) when the key is absent. */
function readTracker(properties: Record<string, string>): number {
  const raw = properties.tracker;
  if (raw === undefined) return RENDER_MODEL_TRACKER_ANY;
  const parsed = ruleInt(raw);
  return parsed ?? RENDER_MODEL_TRACKER_ANY;
}

/** The `"…"` body of a TSCN string literal, or the raw text if it isn't one. */
function quotedStringContent(value: string): string {
  const match = value.match(/^"([\s\S]*)"$/);
  return match ? match[1]! : value;
}

/**
 * Walks every ANCESTOR (not just the immediate parent), reusing
 * `parentTypeVerdict` at each step. See the file docblock for why this beats
 * hand-rolling the instanced/untyped exemption again.
 */
function ancestorHasXROrigin3D(scene: TscnScene, node: TscnNode): ParentVerdict {
  let current = node;
  for (;;) {
    const verdict = parentTypeVerdict(scene, current, 'XROrigin3D');
    if (verdict.kind !== 'mismatch') return verdict;
    current = verdict.parent;
  }
}

function checkOpenXRRenderModelManager(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.properties as unknown as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  const tracker = readTracker(properties);
  const directParentOnly =
    tracker === RENDER_MODEL_TRACKER_ANY || tracker === RENDER_MODEL_TRACKER_NONE_SET;

  if (directParentOnly) {
    const rawPose = properties.make_local_to_pose;
    const hasPose = rawPose !== undefined && quotedStringContent(rawPose).length > 0;
    if (hasPose) {
      diagnostics.push({
        severity: 'warning',
        message: `OpenXRRenderModelManager '${node.name}' sets make_local_to_pose without picking a hand tracker (tracker is Any or None set), so Godot never resolves a pose to make render models local to.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: TRACKER_RULE,
      });
    }
  }

  const verdict = directParentOnly
    ? parentTypeVerdict(scene, node, 'XROrigin3D')
    : ancestorHasXROrigin3D(scene, node);

  if (verdict.kind !== 'satisfied' && verdict.kind !== 'unknowable') {
    diagnostics.push({
      severity: 'warning',
      message: `OpenXRRenderModelManager '${node.name}' has no XROrigin3D ${directParentOnly ? 'parent' : 'ancestor'}, so Godot manages no render models for it.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: PARENT_RULE,
    });
  }

  return diagnostics;
}

const openXRRenderModelManagerRule: LintRule = {
  meta: {
    name: 'valid-openxrrendermodelmanager-config',
    description:
      "Warns on OpenXRRenderModelManager's two checkable configuration warnings: make_local_to_pose set without a tracker, and no XROrigin3D reachable",
    category: 'validation',
    applicableNodeTypes: ['OpenXRRenderModelManager'],
    emits: [
      { ruleName: TRACKER_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: PARENT_RULE, severity: 'warning', grounding: { kind: 'configuration-warning' } },
    ],
  },
  check: checkOpenXRRenderModelManager,
};

ruleRegistry.register(openXRRenderModelManagerRule);

export { openXRRenderModelManagerRule };
