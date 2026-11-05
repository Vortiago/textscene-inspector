import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseFoldableContainer } from './parser';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseFoldableContainer', () => {
  it('parses folded, title and the two layout enums', () => {
    const p = parseFoldableContainer(h({ name: 'F', type: 'FoldableContainer' }), {
      folded: 'true',
      title: '"Inventory"',
      title_alignment: '1',
      title_position: '1',
      title_text_overrun_behavior: '3',
    });
    expect(p.folded).toBe(true);
    expect(p.title).toBe('Inventory');
    expect(p.titleAlignment).toBe(1);
    expect(p.titlePosition).toBe(1);
    expect(p.titleTextOverrunBehavior).toBe(3);
  });

  it('defaults folded to false and leaves title/enums undefined when absent', () => {
    const p = parseFoldableContainer(h({ name: 'F', type: 'FoldableContainer' }), {});
    expect(p.folded).toBe(false);
    expect(p.title).toBeUndefined();
    expect(p.titleAlignment).toBeUndefined();
    expect(p.titlePosition).toBeUndefined();
    expect(p.titleTextOverrunBehavior).toBeUndefined();
  });

  it('treats a malformed folded value as false, per boolSlotValue', () => {
    const p = parseFoldableContainer(h({ name: 'F', type: 'FoldableContainer' }), { folded: 'nope' });
    expect(p.folded).toBe(false);
  });

  it('defaults title_text_direction to AUTO and language to empty', () => {
    const p = parseFoldableContainer(h({ name: 'F', type: 'FoldableContainer' }), {});
    expect([p.titleTextDirection, p.language]).toEqual([0, '']);
  });

  it('reads title_text_direction and language', () => {
    const p = parseFoldableContainer(h({ name: 'F', type: 'FoldableContainer' }), {
      title_text_direction: '2',
      language: '"he"',
    });
    expect([p.titleTextDirection, p.language]).toEqual([2, 'he']);
  });

  it('refuses a title_text_direction of -1, which `ERR_FAIL_INDEX` rejects (`foldable_container.cpp:156`)', () => {
    const p = parseFoldableContainer(h({ name: 'F', type: 'FoldableContainer' }), {
      title_text_direction: '-1',
    });
    expect(p.titleTextDirection).toBe(0);
  });
});
