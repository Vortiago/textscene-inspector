/** The parser cases every Joint3D limit parser shares. Test-only. */
import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { heading } from '../../../../parser/testing/parserKit';

type Parse = (heading: ParsedHeading, properties: Record<string, string>) => object;

/**
 * Every key in `unreadable` reads as `undefined` when unauthored, so the consumer applies Godot's
 * default, and when its value is the text given, not as `NaN`.
 */
export function describeUnsetAndUnreadableKeys(
  label: string,
  type: string,
  parse: Parse,
  unreadable: Record<string, string>
) {
  const node = heading(type, { name: 'Joint' });
  const valuesOf = (properties: Record<string, string>) => {
    const parsed = parse(node, properties) as Record<string, unknown>;
    return Object.fromEntries(Object.keys(unreadable).map((key) => [key, parsed[key]]));
  };
  const allUndefined = Object.fromEntries(Object.keys(unreadable).map((key) => [key, undefined]));

  describe(`${label} unset and unreadable keys`, () => {
    it('leaves unauthored keys undefined, so the consumer applies Godot defaults', () => {
      expect(valuesOf({})).toEqual(allUndefined);
    });

    it('reads an unreadable key as undefined, not NaN', () => {
      expect(valuesOf(unreadable)).toEqual(allUndefined);
    });
  });
}
