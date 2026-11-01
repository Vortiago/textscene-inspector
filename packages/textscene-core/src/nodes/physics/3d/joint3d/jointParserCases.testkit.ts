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
  type: string,
  parse: Parse,
  unreadable: Record<string, string>
) {
  const node = heading(type, { name: 'Joint' });
  const expectUndefined = (properties: Record<string, string>) => {
    const parsed: Record<string, unknown> = parse(node, properties);
    for (const key of Object.keys(unreadable)) expect(parsed[key], key).toBeUndefined();
  };

  describe(`${type} parser unset and unreadable keys`, () => {
    it('leaves unauthored keys undefined, so the consumer applies Godot defaults', () => {
      expectUndefined({});
    });

    it('reads an unreadable key as undefined, not NaN', () => {
      expectUndefined(unreadable);
    });
  });
}
