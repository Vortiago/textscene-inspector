/**
 * The source pane keeps its set width in a browser. happy-dom does no flex layout, so this
 * reads `.sourcePane { flex-shrink: 0 }` from the CSS module source. The path starts at
 * `import.meta.dirname`, not `process.cwd()`, which is the repo root under lint-staged and CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('#200 source pane — CSS keeps the rendered width honored', () => {
  it('.sourcePane declares flex-shrink:0 so the flex row cannot squeeze it below its set width', () => {
    const css = readFileSync(join(import.meta.dirname, 'r3f-main.module.css'), 'utf8');
    const start = css.indexOf('.sourcePane');
    expect(start).toBeGreaterThanOrEqual(0);
    const paneBlock = css.slice(start, css.indexOf('}', start) + 1);
    expect(paneBlock).toMatch(/flex-shrink:\s*0/);
  });
});
