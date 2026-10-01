import { describe, expect, it } from 'vitest';
import { blocksIn } from './testBlocks.js';

const titlesIn = (src: string): string[] => blocksIn('synthetic.test.ts', src).map((b) => b.title);

describe('blocksIn', () => {
  it('reads a title through the quote it opens with, not the first quote it meets', () => {
    const src =
      'it(\'reports nothing when max_size is Vector2i(0, 0) (the "no maximum" sentinel)\', () => {});';

    expect(titlesIn(src)).toEqual([
      'reports nothing when max_size is Vector2i(0, 0) (the "no maximum" sentinel)',
    ]);
  });

  it('reads the title of an .each case from its second call', () => {
    const src = ['const table = [{ a: 1 }];', "it.each(table)('d (%o)', () => {});"].join('\n');

    expect(titlesIn(src)).toEqual(['d (%o)']);
  });

  it('opens no block where a title spells one', () => {
    const src = [
      "it('refuses a negative index, as set_slot does it (graph_node.cpp:706)', () => {",
      "  expect(check('slot/-1/left_enabled', 'true')).toBeNull();",
      '});',
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => b.body)).toEqual([src.slice(0, -';'.length)]);
  });

  it('opens no block at a method call named test', () => {
    const src = "it('matches', () => { expect(SOME_RE.test(value)).toBe(true); });";

    expect(blocksIn('synthetic.test.ts', src).map((b) => b.body)).toEqual([src.slice(0, -';'.length)]);
  });

  it('opens no block inside a comment', () => {
    const src = ["// it('commented out', () => {});", "it('live', () => {});"].join('\n');

    expect(titlesIn(src)).toEqual(['live']);
  });

  it('ends a body at its own call, never at a table declared below it', () => {
    const src = [
      "it('passes a valid node', () => {",
      '  expectClean(scene(node()));',
      '});',
      'runPropertyValidation({ nodeType: "GraphNode" }, [',
      "  { prop: 'x', invalid: [{ value: 1, severity: 'warning' }] },",
      ']);',
    ].join('\n');

    expect(blocksIn('synthetic.test.ts', src)[0]?.body).not.toContain('runPropertyValidation');
  });

  it('numbers each block by the line it starts on', () => {
    const src = ["it('first', () => {});", '', "it('third', () => {});"].join('\n');

    expect(blocksIn('synthetic.test.ts', src).map((b) => b.line)).toEqual([1, 3]);
  });
});
