/**
 * Strict TSCN parser for linting: an adapter over TscnParserCore's scanning loop. Its observer (`strictObserver/`)
 * collects syntax and format errors as ParseError[], checks headings strictly and runs the registered property
 * validators. The lenient renderer runs the same loop with no observer.
 */

import type { BuiltSection, RawNode } from '../parser/types.js';
import type { SceneTree } from '../parser/sceneTreeBuilder.js';
import type { SectionLines, StrictParseResult } from './types.js';
import { placementFacts } from './placementFacts.js';
import { strictObserver } from './strictObserver/strictObserver.js';
import { TscnParserCore } from '../parser/TscnParserCore.js';
import { createRawNode } from '../parser/rawNode.js';

/**
 * Files each heading's lines under the tree's copy of its node as well, since a rule reaches a
 * node through the tree and the scan filed the lines under the heading's own node.
 */
function fileLinesUnderSeats(lines: Map<BuiltSection, SectionLines>, { seated }: SceneTree<RawNode>): void {
  for (const [heading, seat] of seated) {
    const headingLines = lines.get(heading);
    if (headingLines) lines.set(seat, headingLines);
  }
}

export class StrictTscnParser {
  private core = new TscnParserCore();

  /**
   * Strictly parse TSCN content
   * @param content - TSCN file content
   * @returns Parse result with errors or parsed scene
   */
  parse(content: string): StrictParseResult {
    const { observer, errors, lines, headingReads } = strictObserver();
    const { scene, origins, tree } = this.core.parse(content, createRawNode, observer);

    // The scene comes back even when a property failed: a bad value does not invalidate the tree. Withholding it
    // would skip the rule phase, so one out-of-range property would silence every semantic rule in the file, and a
    // rule whose condition a validator rejects would never run.
    fileLinesUnderSeats(lines, tree);

    return {
      errors,
      scene: { ...scene, ...placementFacts(origins, tree), ...headingReads },
      lines,
    };
  }
}
