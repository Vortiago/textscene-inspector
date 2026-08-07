/**
 * Semantic linter rule for Bone2D, from Godot's own configuration warnings,
 * `Bone2D::get_configuration_warnings()` (skeleton_2d.cpp:412-427):
 *
 *     if (!skeleton) {
 *         if (parent_bone) {
 *             warnings.push_back(RTR("This Bone2D chain should end at a Skeleton2D node."));
 *         } else {
 *             warnings.push_back(RTR("A Bone2D only works with a Skeleton2D or another Bone2D as parent node."));
 *         }
 *     }
 *     if (rest == Transform2D(0, 0, 0, 0, 0, 0)) {
 *         warnings.push_back(RTR("This bone lacks a proper REST pose. Go to the Skeleton2D node and set one."));
 *     }
 *
 * `skeleton`/`parent_bone` are resolved once at `NOTIFICATION_ENTER_TREE`
 * (skeleton_2d.cpp:97-119): `parent_bone` is `cast_to<Bone2D>(get_parent())`,
 * fixed at the IMMEDIATE parent only; `skeleton` then walks further up through
 * zero-or-more Bone2D links, stopping at the first Skeleton2D it finds or the
 * first ancestor that is neither Bone2D nor Skeleton2D (whichever comes
 * first). Mirrored below with a static ancestor walk; `descendsFrom` stands in
 * for `cast_to`, which also accepts subclasses.
 *
 * `rest` field-initialises to `Transform2D rest;` (skeleton_2d.h:48) — the
 * IDENTITY matrix, since `Transform2D`'s default constructor
 * (`core/math/transform_2d.h`) leaves it untouched at identity — not the
 * all-zero literal this warning tests for. Godot omits a property at its
 * serialised default, so an ABSENT `rest` key is the identity default and must
 * never trip this: only an explicit `Transform2D(0, 0, 0, 0, 0, 0)` does.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import type { TscnNode, TscnScene } from '../../../parser/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { findParentNode, isValidProperties } from '../../../linter/linterUtils.js';
import { descendsFrom } from '../../../linter/nodeBaseTypes.js';
import { makeFloatTupleRegex } from '../../../linter/validators/floatTupleValidator.js';

const CHAIN_RULE = 'bone2d-chain-does-not-terminate';
const PARENT_RULE = 'bone2d-invalid-parent';
const REST_RULE = 'bone2d-missing-rest-pose';

type AncestryVerdict =
  /** A Skeleton2D was found, through zero-or-more Bone2D links. */
  | 'satisfied'
  /** The immediate parent is a Bone2D, but its own chain never reaches a Skeleton2D. */
  | 'chain-broken'
  /** The immediate parent is neither a Skeleton2D nor a Bone2D (root included). */
  | 'invalid-parent'
  /** An ancestor's type is not knowable from this file (`instance=` or untyped). */
  | 'unknowable';

/** Mirrors `Bone2D::_notification(NOTIFICATION_ENTER_TREE)` (skeleton_2d.cpp:99-113). */
function ancestryVerdict(scene: TscnScene, node: TscnNode): AncestryVerdict {
  let current = findParentNode(scene.nodes, node);
  if (!current) return 'invalid-parent'; // root: parent_bone and skeleton both stay null

  if (current.instance || !current.type) return 'unknowable';
  const parentIsBone2D = descendsFrom(current.type, 'Bone2D');

  while (current) {
    if (current.instance || !current.type) return 'unknowable';
    if (descendsFrom(current.type, 'Skeleton2D')) return 'satisfied';
    if (!descendsFrom(current.type, 'Bone2D')) break;
    current = findParentNode(scene.nodes, current);
  }

  return parentIsBone2D ? 'chain-broken' : 'invalid-parent';
}

const TRANSFORM2D_RE = makeFloatTupleRegex('Transform2D', 6);

/**
 * `rest == Transform2D(0, 0, 0, 0, 0, 0)` — `Transform2D::operator==`
 * (transform_2d.h:158-165) compares each column with exact `!=`, not an
 * approximate tolerance, so this does too. A malformed literal is
 * `linterParser.ts`'s job, not this rule's; it just reports "not all-zero".
 */
function isAllZeroTransform2D(raw: string): boolean {
  const match = TRANSFORM2D_RE.exec(raw);
  if (!match) return false;
  for (let i = 1; i <= 6; i++) {
    if (Number(match[i]) !== 0) return false;
  }
  return true;
}

function checkBone2D(context: RuleContext): Diagnostic[] {
  const { node, scene } = context;
  const diagnostics: Diagnostic[] = [];

  switch (ancestryVerdict(scene, node)) {
    case 'chain-broken':
      diagnostics.push({
        severity: 'warning',
        message: `Bone2D '${node.name}' chains through Bone2D ancestors that never reach a Skeleton2D node. This Bone2D chain should end at a Skeleton2D node.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: CHAIN_RULE,
      });
      break;
    case 'invalid-parent':
      diagnostics.push({
        severity: 'warning',
        message: `Bone2D '${node.name}' only works with a Skeleton2D or another Bone2D as parent node.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: PARENT_RULE,
      });
      break;
    default:
      break;
  }

  if (isValidProperties(node.properties)) {
    const rest = node.properties.rest;
    if (rest !== undefined && isAllZeroTransform2D(rest)) {
      diagnostics.push({
        severity: 'warning',
        message: `Bone2D '${node.name}' has rest set to the all-zero Transform2D. This bone lacks a proper REST pose; go to the Skeleton2D node and set one.`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: REST_RULE,
      });
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
    emits: [
      { ruleName: CHAIN_RULE, severity: 'warning' },
      { ruleName: PARENT_RULE, severity: 'warning' },
      { ruleName: REST_RULE, severity: 'warning' },
    ],
  },
  check: checkBone2D,
};

ruleRegistry.register(bone2DAncestryRule);

export { bone2DAncestryRule };
