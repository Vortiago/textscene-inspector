import { TscnParser } from '@textscene/core';

export function resolveForwardedContent(buffer: string, lastGood: string): string {
  try {
    const scene = new TscnParser().parse(buffer);
    if (scene.nodes.length > 0) return buffer;
  } catch {
    /* total — never throws */
  }
  return lastGood;
}
