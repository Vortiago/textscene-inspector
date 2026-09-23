/**
 * Probe nodes for the conformance suites: a node of a given type with only what its parser produces
 * by default. Each probe goes through the real `TscnParser`, so a parser or registry mismatch fails.
 */
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';

const PROBE_NAME = 'Probe';

function parseProbe(body: string): TscnNode {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}`).nodes[0]!;
}

/** `type` as a root node, with no properties set. */
export function parseBareNode(type: string): TscnNode {
  return parseProbe(`[node name="${PROBE_NAME}" type="${type}"]\n`);
}

/** `type` as a root node with `visible = false`. */
export function parseHiddenNode(type: string): TscnNode {
  return parseProbe(`[node name="${PROBE_NAME}" type="${type}"]\nvisible = false\n`);
}

/**
 * `type` as a root node carrying one child, for asserting that a type renders
 * whatever is nested under it rather than dropping its subtree.
 */
export function parseWithChild(type: string, childType: string, childName: string): TscnNode {
  return parseProbe(
    `[node name="${PROBE_NAME}" type="${type}"]\n\n[node name="${childName}" type="${childType}" parent="."]\n`
  );
}
