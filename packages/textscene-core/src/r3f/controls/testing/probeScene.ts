/**
 * Probe nodes for the conformance suites — a node of a given type carrying
 * only what its own parser produces by default.
 *
 * Every conformance suite (node-level, DOM Control, native Control) needs the
 * same thing: drive a type through the REAL `TscnParser` rather than
 * hand-building a `TscnNode`, so a parser/registry mismatch fails too. Shared
 * so the synthesised scene's shape — its header, the probe's name — is defined
 * once instead of being kept in step by hand across four suites.
 */
import { TscnParser } from '../../../parser/TscnParser';
import type { TscnNode } from '../../../parser/types';

const PROBE_NAME = 'Probe';

function parseProbe(body: string): TscnNode {
  return new TscnParser().parse(`[gd_scene format=3]\n\n${body}`).nodes[0];
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
