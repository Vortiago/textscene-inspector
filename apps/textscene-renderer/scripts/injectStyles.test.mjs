import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { injectStyles } from './injectStyles.mjs';

/** Runs the statement that heads `injectStyles`' output in a page, and returns the page's <head>. */
function headAfter(source, globals) {
  const children = [];
  const document = {
    createElement: () => ({}),
    head: { appendChild: (child) => children.push(child) },
  };
  runInNewContext(source, { document, ...globals });
  return children;
}

describe('injectStyles', () => {
  it('adds the stylesheet to the head of the page the bundle loads in', () => {
    const [style, ...others] = headAfter(injectStyles('', '.root { height: 100%; }'), {});

    expect(style).toMatchObject({ textContent: '.root { height: 100%; }' });
    expect(others).toEqual([]);
  });

  it('keeps the bundle after the statement', () => {
    expect(injectStyles('export const answer = 42;', '.a {}')).toMatch(/\nexport const answer = 42;$/);
  });

  it('does nothing where there is no document, so the bundle loads in Node', () => {
    expect(() => runInNewContext(injectStyles('', '.a {}'), {})).not.toThrow();
  });

  it('leaves a bundle with no styles as it is', () => {
    expect(injectStyles('export {};', '')).toBe('export {};');
  });
});
