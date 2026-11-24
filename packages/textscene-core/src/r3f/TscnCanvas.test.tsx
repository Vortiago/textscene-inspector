import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

describe('the canvas container CSS', () => {
  it('claims every touch gesture, so touch navigation gets pointermove at all', () => {
    // Read from source: the goldens do not see CSS, and happy-dom has no cascade.
    // R3F 9.x sets no touch-action, so without it a one-finger drag scrolls.
    const css = readFileSync(path.join(import.meta.dirname, 'TscnCanvas.module.css'), 'utf8');
    const root = /\.root\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(root).toContain('touch-action: none');
  });
});
