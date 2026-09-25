/** The gate between the pane buffer and the renderer: it forwards only a renderable buffer. */
import { parseTscnContent } from '@textscene/core';

/**
 * The gate runs `parseTscnContent`, as `useParsedScene` does on the forwarded content, so
 * "valid" here and "renderable" there cannot drift. The path matters only for GLB detection
 * and scene identity, and the pane always holds .tscn text.
 */
const GATE_PROBE_PATH = 'res://source-gate-probe.tscn';

export function resolveForwardedContent(buffer: string, lastGood: string): string {
  // An emptied buffer holds the last good content. The shell treats blank content as
  // "nothing loaded", and a whitespace-only buffer parses to an empty scene graph.
  if (buffer.trim().length === 0) return lastGood;
  return parseTscnContent(buffer, GATE_PROBE_PATH).sceneGraph ? buffer : lastGood;
}
