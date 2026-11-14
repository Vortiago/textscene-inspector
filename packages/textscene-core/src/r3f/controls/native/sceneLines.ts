/**
 * The scene lines a constructor's setters stand for, when a class builds its internal Controls from
 * them: one parse through each class's own parser, so a built Control reads what an authored one would.
 */
import { parseNodeWithRegistry } from '../../../core/NodeRegistry';

/** The line of a Control its constructor hides (`set_visible(false)`). */
export const HIDDEN_LINE: Readonly<Record<string, string>> = Object.freeze({ visible: 'false' });

/** The `visible` line of a Control shown only while `isShown`. A flag left out is on. */
export function shownIf(isShown: boolean | undefined): Record<string, string> {
  return isShown === false ? { ...HIDDEN_LINE } : {};
}

/**
 * What a Control of `type` named `name` parses to from `lines`.
 *
 * @canonical Parse the scene lines of a built internal Control
 */
export function parsedSceneLines(type: string, name: string, lines: Record<string, string> = {}): object {
  const parsed = parseNodeWithRegistry({ type: 'node', attributes: { name, type } }, lines);
  if (!parsed) throw new Error(`expected a parser for ${type}, got none`);
  return parsed.properties;
}
