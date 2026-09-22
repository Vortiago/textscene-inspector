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
});
