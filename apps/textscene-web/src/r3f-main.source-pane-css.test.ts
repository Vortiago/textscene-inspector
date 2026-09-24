/**
 * The source pane's load-bearing CSS. happy-dom does no layout, so this reads the CSS module
 * source. The path starts at `import.meta.dirname`, not `process.cwd()`, which is the repo root
 * under lint-staged and CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(join(import.meta.dirname, 'r3f-main.module.css'), 'utf8');

/** The declarations of the rule whose whole selector is `.name`, without its comments. */
function declarations(name: string): string {
  const match = new RegExp(`^\\.${name}\\s*\\{([^}]*)\\}`, 'm').exec(css);
  expect(match, `.${name} has a rule of its own`).not.toBeNull();
  return match![1]!.replace(/\/\*[\s\S]*?\*\//g, '');
}

describe('source pane CSS', () => {
  it('.sourcePane declares flex-shrink:0 so the flex row cannot squeeze it below its set width', () => {
    expect(declarations('sourcePane')).toMatch(/flex-shrink:\s*0/);
  });

  it('.gutter clips nothing, since a 20px clip hides every row popover', () => {
    expect(declarations('gutter')).not.toMatch(/overflow/);
  });

  it('.sourceBody clips the gutter rows scrolled out of view instead', () => {
    expect(declarations('sourceBody')).toMatch(/overflow:\s*hidden/);
  });

  it(".sourceBody is the size container the gutter popover's cqw width reads", () => {
    expect(declarations('sourceBody')).toMatch(/container-type:\s*inline-size/);
    expect(declarations('gutterPopover')).toMatch(/max-width:[^;]*100cqw/);
  });

  it('.sourcePaneHeader holds the file-level popover, which spans it inside the pane', () => {
    expect(declarations('sourcePaneHeader')).toMatch(/position:\s*relative/);
    const popover = declarations('fileProblemsPopover');
    expect(popover).toMatch(/top:\s*100%/);
    expect(popover).toMatch(/left:/);
    expect(popover).toMatch(/right:/);
  });

  it('.fileProblemsPopover scrolls a long list instead of running past the pane', () => {
    const popover = declarations('fileProblemsPopover');
    expect(popover).toMatch(/max-height:/);
    expect(popover).toMatch(/overflow-y:\s*auto/);
  });

  it('.problemPopover positions both popovers over the textarea', () => {
    const popover = declarations('problemPopover');
    expect(popover).toMatch(/position:\s*absolute/);
    expect(popover).toMatch(/z-index:\s*\d+/);
  });
});
