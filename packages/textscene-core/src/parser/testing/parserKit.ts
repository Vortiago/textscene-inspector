/**
 * Shared test-kit for parser slice tests.
 *
 * Collapses the local `heading()` factory that ~37 parser.test.ts files
 * re-declared to build a node ParsedHeading. Build-excluded via the
 * `src/**\/testing/**` tsconfig rule, like the linter test-kit.
 */

import type { ParsedHeading } from '../utils';

/**
 * Build a `[node ...]` ParsedHeading for the given node type. `name` defaults
 * to the type; extra attributes (`name`, `parent`, `groups`, …) merge in and
 * may override it.
 */
export function heading(type: string, attributes: Record<string, string> = {}): ParsedHeading {
  return { type: 'node', attributes: { name: type, type, ...attributes } };
}
