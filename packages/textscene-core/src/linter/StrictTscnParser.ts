/**
 * Strict TSCN parser for linting: an adapter over TscnParserCore's scanning loop. Its observer (`strictObserver/`)
 * collects syntax and format errors as ParseError[], checks headings strictly and runs the registered property
 * validators. The lenient renderer runs the same loop with no observer.
 */

import type { StrictParseResult } from './types.js';
import { placementFacts } from './placementFacts.js';
import { strictObserver } from './strictObserver/strictObserver.js';
import { TscnParserCore } from '../parser/TscnParserCore.js';
import { createRawNode } from '../parser/rawNode.js';

export class StrictTscnParser {
  private core = new TscnParserCore();

  /**
   * Strictly parse TSCN content
   * @param content - TSCN file content
   * @returns Parse result with errors or parsed scene
   */
  parse(content: string): StrictParseResult {
    const { observer, errors, lines, headingReads } = strictObserver();
    const { scene, origins } = this.core.parse(content, createRawNode, observer);

    // The scene comes back even when a property failed: a bad value does not invalidate the tree. Withholding it
    // would skip the rule phase, so one out-of-range property would silence every semantic rule in the file, and a
    // rule whose condition a validator rejects would never run.
    return {
      errors,
      scene: { ...scene, ...placementFacts(origins, scene.nodes), ...headingReads },
      lines,
    };
  }
}
