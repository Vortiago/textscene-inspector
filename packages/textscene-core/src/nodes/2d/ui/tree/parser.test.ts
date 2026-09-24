/** Tree parser contract: the Control base plus columns/column_titles_visible. */
import { describe, it, expect } from 'vitest';
import { parseTree } from './parser';

const heading = { type: 'node', attributes: { type: 'Tree', name: 'FileTree' } };

describe('parseTree', () => {
  it('reads columns and column_titles_visible (happy path)', () => {
    const result = parseTree(heading, { columns: '3', column_titles_visible: 'true' });
    expect(result.name).toBe('FileTree');
    expect(result.columns).toBe(3);
    expect(result.columnTitlesVisible).toBe(true);
  });

  it('leaves a malformed columns value undefined rather than throwing (error path)', () => {
    expect(parseTree(heading, { columns: 'many' }).columns).toBeUndefined();
  });

  it('handles a bare node with no properties at all (edge case)', () => {
    const result = parseTree({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.columns).toBeUndefined();
    expect(result.columnTitlesVisible).toBeUndefined();
  });
});
