import { parseTscnContent } from '@textscene/core';

/**
 * The shell renders whatever `parseTscnContent` accepts (that is what
 * `useParsedScene` runs on the forwarded content), so the gate defers to the
 * SAME helper — "valid" here and "renderable" there can never drift apart.
 * The probe path only matters for GLB detection and scene identity; the pane
 * always holds .tscn text, so a fixed placeholder is fine.
 */
const GATE_PROBE_PATH = 'res://source-gate-probe.tscn';

export function resolveForwardedContent(buffer: string, lastGood: string): string {
  // An emptied buffer never renders — hold the last good content. (The shell
  // treats blank content as a valid "nothing loaded" state; a whitespace-only
  // buffer even parses to an empty scene graph, so gate it out up front.)
  if (buffer.trim().length === 0) return lastGood;
  return parseTscnContent(buffer, GATE_PROBE_PATH).sceneGraph ? buffer : lastGood;
}
