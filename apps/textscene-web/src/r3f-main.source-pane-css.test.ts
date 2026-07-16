/**
 * Source pane, rendered-width regression guard.
 *
 * happy-dom does no flex layout, so the behavioral `.test.tsx` suite reads only
 * the inline `style.width` — it cannot see the real-browser bug where a
 * shrinkable pane renders narrower than its set/dragged width. The fix is a
 * CSS-only one (`.sourcePane { flex-shrink: 0 }`) that nothing in happy-dom can
 * observe, so pin it by reading the raw CSS module text. Anchor the path at
 * `import.meta.dirname` (the test file's own dir), NOT `process.cwd()`: vitest
 * runs from the package dir under `pnpm --filter` but from the repo root under
 * lint-staged / CI, and a cwd-relative path breaks there.
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
