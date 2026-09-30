/**
 * Bone2D rule from `Bone2D::get_configuration_warnings()` (skeleton_2d.cpp:412-427).
 * A missing Skeleton2D warns "chain should end at a Skeleton2D" under a Bone2D
 * parent and "only works with a Skeleton2D or another Bone2D" otherwise. An
 * all-zero `rest` warns that the bone lacks a rest pose.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armEmits, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../godot/nodeBaseTypes.js';
import { knownParent, searchAncestors } from '../../../linter/parentType.js';
import { tupleComponent } from '../../../linter/validators/commonValidators.js';
import { makeFloatTupleRegex } from '../../../linter/validators/floatTupleValidator.js';

const arms = {
  chainDoesNotTerminate: {
    severity: 'warning',
    ruleName: 'bone2d-chain-does-not-terminate',
    grounding: { kind: 'configuration-warning' },
  },
  invalidParent: {
    severity: 'warning',
    ruleName: 'bone2d-invalid-parent',
    grounding: { kind: 'configuration-warning' },
  },
  missingRestPose: {
    severity: 'warning',
    ruleName: 'bone2d-missing-rest-pose',
    grounding: { kind: 'configuration-warning' },
  },
} as const satisfies RuleArms<string>;

type AncestryVerdict =
  /** A Skeleton2D was found, through zero-or-more Bone2D links. */
  | 'satisfied'
  /** The immediate parent is a Bone2D, but its own chain never reaches a Skeleton2D. */
  | 'chain-broken'
  /** The immediate parent is neither a Skeleton2D nor a Bone2D (root included). */
  | 'invalid-parent'
  /** An ancestor's type is not knowable from this file (`instance=` or untyped). */
  | 'unknowable';

/**
 * Mirrors `Bone2D::_notification(NOTIFICATION_ENTER_TREE)` (skeleton_2d.cpp:99-113),
 * which resolves once (skeleton_2d.cpp:97-119): `parent_bone` is the immediate parent
 * cast to Bone2D, and `skeleton` walks up through Bone2D links to the first Skeleton2D
 * or non-bone. `descendsFrom` stands in for `cast_to`, which accepts subclasses.
 */
function ancestryVerdict(scene: TscnScene, node: TscnNode): AncestryVerdict {
  const parent = knownParent(scene, node);
  if (parent.kind === 'root') return 'invalid-parent'; // parent_bone and skeleton both stay null
  if (parent.kind === 'unknowable') return 'unknowable';
  const parentIsBone2D = descendsFrom(parent.parent.type, 'Bone2D');

  // The chain ends at the first ancestor that is neither, so an ancestor whose
  // class this file never states could be the Skeleton2D or the terminator.
  const search = searchAncestors<'satisfied' | 'chain-end'>(scene, node, (ancestor) => {
    if (descendsFrom(ancestor.type, 'Skeleton2D')) return 'satisfied';
    if (!descendsFrom(ancestor.type, 'Bone2D')) return 'chain-end';
    return undefined;
  });
  if (search.kind === 'unknowable') return 'unknowable';
  if (search.kind === 'found' && search.value === 'satisfied') return 'satisfied';

  return parentIsBone2D ? 'chain-broken' : 'invalid-parent';
}

const TRANSFORM2D_RE = makeFloatTupleRegex('Transform2D', 6);

/**
 * `rest == Transform2D(0, 0, 0, 0, 0, 0)`: `Transform2D::operator==`
 * (transform_2d.h:158-165) compares each column with exact `!=`, so this does too.
 * A malformed literal reports "not all-zero", since `linterParser.ts` owns format.
 */
function isAllZeroTransform2D(raw: string): boolean {
  const match = TRANSFORM2D_RE.exec(raw);
  if (!match) return false;
  for (let i = 1; i <= 6; i++) {
    if (tupleComponent(match[i]) !== 0) return false;
  }
  return true;
}

function checkBone2D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const diagnostics: Diagnostic[] = [];

  switch (ancestryVerdict(scene, node)) {
    case 'chain-broken':
      reportArm(
        diagnostics,
        arms.chainDoesNotTerminate,
        node,
        `Bone2D '${node.name}' chains through Bone2D ancestors that never reach a Skeleton2D node. This Bone2D chain should end at a Skeleton2D node.`
      );
      break;
    case 'invalid-parent':
      reportArm(
        diagnostics,
        arms.invalidParent,
        node,
        `Bone2D '${node.name}' only works with a Skeleton2D or another Bone2D as parent node.`
      );
      break;
    default:
      break;
  }

  if (isValidProperties(node.properties)) {
    const rest = node.properties.rest;
    // `rest` is declared `Transform2D rest;` (skeleton_2d.h:48), but `Bone2D::Bone2D()`
    // zeroes all three columns (skeleton_2d.cpp:496-499). All-zero is the class default
    // the serialiser omits, so an absent key is the state the warning exists for.
    if (rest === undefined || isAllZeroTransform2D(rest)) {
      reportArm(
        diagnostics,
        arms.missingRestPose,
        node,
        `Bone2D '${node.name}' has no rest pose: its rest is the all-zero Transform2D, which is what an unset one stores. Go to the Skeleton2D node and set one.`
      );
    }
  }

  return diagnostics;
}

const bone2DAncestryRule: LintRule = {
  meta: {
    name: 'valid-bone2d-ancestry',
    description:
      "Warns when a Bone2D's ancestor chain never reaches a Skeleton2D, its immediate parent is neither a Skeleton2D nor a Bone2D, or its rest pose is the all-zero Transform2D",
    category: 'validation',
    applicableNodeTypes: ['Bone2D'],
    emits: armEmits(arms),
  },
  check: checkBone2D,
};

ruleRegistry.register(bone2DAncestryRule);

export { bone2DAncestryRule };
