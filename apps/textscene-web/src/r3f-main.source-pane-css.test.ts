/**
 * The source pane's load-bearing CSS. happy-dom does no layout, so this reads the CSS module
 * source. The path starts at `import.meta.dirname`, not `process.cwd()`, which is the repo root
 * under lint-staged and CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMPACT_LAYOUT_QUERY } from '@textscene/core';

const css = readFileSync(join(import.meta.dirname, 'r3f-main.module.css'), 'utf8');

/** The declarations of the rule whose whole selector is `.name`, without its comments. */
function declarations(name: string): string {
  const match = new RegExp(`^\\.${name}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  expect(match, `.${name} has a rule of its own`).not.toBeNull();
  return match![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** The body of the `@media <query>` block, whose rules are one level deep. */
function mediaBlock(query: string): string {
  const start = css.indexOf(`@media ${query} {`);
  expect(start, `an @media ${query} block`).toBeGreaterThanOrEqual(0);
  const end = css.indexOf('\n}', start);
  return css.slice(start, end);
}

describe('source pane CSS', () => {
  it('.sourcePane declares flex-shrink:0 so the flex row cannot squeeze it below its set width', () => {
    expect(declarations('sourcePane')).toMatch(/flex-shrink:\s*0/);
  });

  it('.sourcePane reads its width from the custom property the splitter sets', () => {
    expect(declarations('sourcePane')).toMatch(/width:\s*var\(--source-pane-width,\s*320px\)/);
    expect(css).not.toMatch(/!important/);
  });

  it('covers the preview below the top bar in the compact layout', () => {
    const block = mediaBlock(COMPACT_LAYOUT_QUERY);
    expect(block).toMatch(/\.sourcePane\s*\{[^}]*position:\s*absolute/);
    expect(block).toMatch(/\.sourcePane\s*\{[^}]*top:\s*var\(--tsi-top-bar-height\)/);
    expect(block).toMatch(/\.sourcePane\s*\{[^}]*width:\s*auto/);
    expect(block).toMatch(/\.sourceSplitter,\s*\.wideLabel\s*\{[^}]*display:\s*none/);
  });

  it('keeps the source text at 16px in the compact layout, so iOS does not zoom on focus', () => {
    expect(mediaBlock(COMPACT_LAYOUT_QUERY)).toMatch(/\.sourceTextarea\s*\{[^}]*font-size:\s*16px/);
  });

  it('fixes the scene palette in the compact layout, since the scrolling toolbar would clip it', () => {
    expect(mediaBlock(COMPACT_LAYOUT_QUERY)).toMatch(/\.palette\s*\{[^}]*position:\s*fixed/);
  });

  it('widens the gutter dot hit area on a coarse pointer and keeps the painted dot round', () => {
    const block = mediaBlock('(pointer: coarse)');
    expect(block).toMatch(/\.severityDot\s*\{[^}]*background-clip:\s*content-box/);
  });

  it('.gutter clips nothing, since a 20px clip hides every row popover', () => {
    expect(declarations('gutter')).not.toMatch(/overflow/);
  });

  it('.sourceBody clips the gutter rows scrolled out of view instead', () => {
    expect(declarations('sourceBody')).toMatch(/overflow:\s*hidden/);
  });

  it(".sourceBody is the size container the gutter popover's cqw width reads", () => {
    expect(declarations('sourceBody')).toMatch(/container-type:\s*inline-size/);
    expect(declarations('gutterPopoverBody')).toMatch(/max-width:[^;]*100cqw/);
  });

  it('.gutterPopover bridges its gap with padding, so the pointer never leaves the row', () => {
    const popover = declarations('gutterPopover');
    expect(popover).toMatch(/left:\s*100%/);
    expect(popover).toMatch(/padding-left:\s*4px/);
    expect(popover).not.toMatch(/margin/);
  });

  it(".gutterPopoverUp opens it upward, bottom edge to the row's bottom edge", () => {
    const up = declarations('gutterPopoverUp');
    expect(up).toMatch(/top:\s*auto/);
    expect(up).toMatch(/bottom:\s*0/);
  });

  it('.sourcePaneHeader holds the file-level popover, which spans it inside the pane', () => {
    expect(declarations('sourcePaneHeader')).toMatch(/position:\s*relative/);
    const popover = declarations('fileProblemsPopover');
    expect(popover).toMatch(/top:\s*100%/);
    expect(popover).toMatch(/left:/);
    expect(popover).toMatch(/right:/);
  });

  it('.fileProblemsPopover caps its height below the header', () => {
    expect(declarations('fileProblemsPopover')).toMatch(/max-height:\s*60vh/);
  });

  it('.problemPopover scrolls a list taller than its cap, in either popover', () => {
    expect(declarations('problemPopover')).toMatch(/overflow-y:\s*auto/);
  });

  it.each(['gutterPopover', 'fileProblemsPopover'])('.%s lies over the textarea', (name) => {
    const popover = declarations(name);
    expect(popover).toMatch(/position:\s*absolute/);
    expect(popover).toMatch(/z-index:\s*\d+/);
  });
});
