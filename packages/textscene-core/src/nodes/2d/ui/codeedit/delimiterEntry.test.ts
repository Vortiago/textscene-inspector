/**
 * One delimiter entry as `CodeEdit::_set_delimiters` splits it and `_add_delimiter` admits it, and
 * the agreement of the three readers that go through it: the validator, the collision rule and the
 * render-side delimiter list.
 */

import { describe, expect, it } from 'vitest';
import type { TscnNode, TscnScene } from '../../../../parser/types';
import { passesDelimiterGuards, splitDelimiterEntry } from './delimiterEntry';
import { delimiterArrayValidator } from './delimiterValidators';
import { codeEditDelimiterCollisionRule } from './linter';
import { buildDelimiters } from './delimiterRegions';

describe('splitDelimiterEntry', () => {
  it('splits a start and an end key at the first space', () => {
    expect(splitDelimiterEntry('/* */')).toEqual({ startKey: '/*', endKey: '*/' });
  });

  it('gives a line-only entry an empty end key, with or without the space', () => {
    expect(splitDelimiterEntry('#')).toEqual({ startKey: '#', endKey: '' });
    expect(splitDelimiterEntry('# ')).toEqual({ startKey: '#', endKey: '' });
  });

  it('reads only the first two slices, as get_slicec does', () => {
    // `get_slicec(' ', 1)` is the text between the first and second spaces.
    expect(splitDelimiterEntry('" " ignored')).toEqual({ startKey: '"', endKey: '"' });
    expect(splitDelimiterEntry('"  "')).toEqual({ startKey: '"', endKey: '' });
    expect(splitDelimiterEntry(' #')).toEqual({ startKey: '', endKey: '#' });
  });
});

describe('passesDelimiterGuards', () => {
  it('admits symbol-only keys', () => {
    expect(passesDelimiterGuards({ startKey: '/*', endKey: '*/' })).toBe(true);
    expect(passesDelimiterGuards({ startKey: '#', endKey: '' })).toBe(true);
  });

  it('refuses an empty start key (code_edit.cpp:3421)', () => {
    expect(passesDelimiterGuards({ startKey: '', endKey: '#' })).toBe(false);
  });

  it('refuses a non-symbol character in either key (code_edit.cpp:3424, :3430)', () => {
    expect(passesDelimiterGuards({ startKey: 'rem', endKey: '' })).toBe(false);
    expect(passesDelimiterGuards({ startKey: '<', endKey: 'x>' })).toBe(false);
    // `is_symbol` excludes the underscore (char_utils.h:113-114).
    expect(passesDelimiterGuards({ startKey: '_', endKey: '' })).toBe(false);
  });
});

describe('the validator, the collision rule and the delimiter list agree on each entry', () => {
  const validate = delimiterArrayValidator('delimiter_comments');

  function ruleSeesCollision(entry: string): boolean {
    const literal = `Array[String](["${entry}"])`;
    const properties = { delimiter_strings: literal, delimiter_comments: literal };
    const node = { name: 'Edit', type: 'CodeEdit', children: [], properties } as TscnNode;
    const scene: TscnScene = { nodes: [node], externalResources: [], internalResources: [] };
    return codeEditDelimiterCollisionRule.check({ scene, node, properties }).length > 0;
  }

  // Each entry sits inside a quoted literal, so none holds a double quote.
  it.each(['#', '# ', '/* */', "' '", 'rem', ' #', '< x>', '_', '<! -->', '--'])(
    'treats %j the same way in all three',
    (entry) => {
      const stored = passesDelimiterGuards(splitDelimiterEntry(entry));
      expect(validate('delimiter_comments', `Array[String](["${entry}"])`, 1) === null).toBe(stored);
      expect(ruleSeesCollision(entry)).toBe(stored);
      expect(buildDelimiters([entry], []).length).toBe(stored ? 1 : 0);
    }
  );
});
