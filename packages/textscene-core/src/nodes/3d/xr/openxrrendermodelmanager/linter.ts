/**
 * The configuration warnings of `OpenXRRenderModelManager::get_configuration_warnings()`
 * (openxr_render_model_manager.cpp:199-226): a `make_local_to_pose` with no hand tracker, and no
 * XROrigin3D. The third reads the project setting `xr/openxr/extensions/render_model`, which no
 * `.tscn` carries, so it is not modelled.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { parentTypeVerdict, type ParentVerdict } from '../../../../linter/parentType.js';
import { ruleInt } from '../../../../linter/validators/commonValidators.js';
import { literalText } from '../../../../godot/index.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';
import type { RawNode, RawScene } from '../../../../parser/types.js';

const arms = {
  trackerRequiredForLocalPose: groundedArm('openxrrendermodelmanager-tracker-required-for-local-pose', {
    kind: 'configuration-warning',
  }),
  parentNotXROrigin3D: groundedArm('openxrrendermodelmanager-parent-not-xrorigin3d', {
    kind: 'configuration-warning',
  }),
} as const satisfies RuleArms<string>;

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

/**
 * Walks every ancestor with `parentTypeVerdict`, so its instanced and untyped exemption holds: a
 * `mismatch` climbs one level, and `satisfied`, `unknowable` or `root` ends the walk.
 */
function ancestorHasXROrigin3D(scene: RawScene, node: RawNode): ParentVerdict {
  let current = node;
  for (;;) {
    const verdict = parentTypeVerdict(scene, current, 'XROrigin3D');
    if (verdict.kind !== 'mismatch') return verdict;
    current = verdict.parent;
  }
}

function checkOpenXRRenderModelManager(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const properties = node.rawProperties;
  const diagnostics: Diagnostic[] = [];

  // ANY(0), the default, and NONE_SET(1) cast only the direct parent. A non-empty
  // `make_local_to_pose` beside them is a reachable state, even with no `tracker` key. LEFT_HAND(2)
  // and RIGHT_HAND(3) search every ancestor.
  const tracker = readTracker(properties);
  const directParentOnly = tracker === RENDER_MODEL_TRACKER_ANY || tracker === RENDER_MODEL_TRACKER_NONE_SET;

  if (directParentOnly) {
    const rawPose = properties.make_local_to_pose;
    // `literalText`, not a hand-rolled unwrap: Godot checks `!make_local_to_pose.is_empty()`
    // (cpp:204), so both jackets the empty string wears, `""` and the StringName `&""` a String
    // slot converts, come off before the length is read.
    const hasPose = rawPose !== undefined && literalText(rawPose) !== '';
    if (hasPose) {
      reportArm(
        diagnostics,
        arms.trackerRequiredForLocalPose,
        node,
        `OpenXRRenderModelManager '${node.name}' sets make_local_to_pose without picking a hand tracker (tracker is Any or None set), so Godot never resolves a pose to make render models local to.`
      );
    }
  }

  const verdict = directParentOnly
    ? parentTypeVerdict(scene, node, 'XROrigin3D')
    : ancestorHasXROrigin3D(scene, node);

  if (verdict.kind !== 'satisfied' && verdict.kind !== 'unknowable') {
    reportArm(
      diagnostics,
      arms.parentNotXROrigin3D,
      node,
      `OpenXRRenderModelManager '${node.name}' has no XROrigin3D ${directParentOnly ? 'parent' : 'ancestor'}, so Godot manages no render models for it.`
    );
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
    emits: armEmits(arms),
  },
  check: checkOpenXRRenderModelManager,
};

ruleRegistry.register(openXRRenderModelManagerRule);

export { openXRRenderModelManagerRule };
