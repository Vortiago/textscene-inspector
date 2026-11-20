/**
 * The top-bar status that the view still builds or uploads textures. It exists
 * only while the count is above zero, so "gone" means detached from the DOM,
 * which is what a capture harness waits for.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { render, screen } from '@testing-library/react';
import { TextureWorkStatus } from './TextureWorkStatus';
import { TEXTURE_WORK_STATUS_TESTID } from './statusTestIds';

describe('<TextureWorkStatus>', () => {
  it('is absent while the view builds no texture', () => {
    render(<TextureWorkStatus pendingTextures={0} />);
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });

  it('announces pending work as a polite status, and leaves once it ends', () => {
    const { rerender } = render(<TextureWorkStatus pendingTextures={2} />);
    const status = screen.getByTestId(TEXTURE_WORK_STATUS_TESTID);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Building textures…');

    rerender(<TextureWorkStatus pendingTextures={0} />);
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });

  it('wears the stat chip, which never wraps inside the fixed-height top bar', () => {
    render(<TextureWorkStatus pendingTextures={1} />);
    expect(screen.getByTestId(TEXTURE_WORK_STATUS_TESTID).className).toMatch(/statChip/);

    const css = readFileSync(path.join(import.meta.dirname, 'TscnPreviewShell.module.css'), 'utf8');
    const chip = /\.statChip\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(chip).toContain('white-space: nowrap');
  });
});
