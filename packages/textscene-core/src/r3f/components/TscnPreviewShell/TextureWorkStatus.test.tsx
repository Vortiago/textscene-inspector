/**
 * The top-bar status that textures are still building or uploading. It exists
 * only while the count is above zero, so "gone" means detached from the DOM,
 * which is what a capture harness waits for.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { textureWork } from '../../../resources/textures/textureWork';
import { TextureWorkStatus } from './TextureWorkStatus';
import { TEXTURE_WORK_STATUS_TESTID } from './statusTestIds';

describe('<TextureWorkStatus>', () => {
  it('is absent while no texture work is pending', () => {
    render(<TextureWorkStatus />);
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });

  it('announces pending work as a polite status, and leaves once it ends', async () => {
    render(<TextureWorkStatus />);
    let end: () => void = () => {};
    await act(async () => {
      end = textureWork.begin();
    });
    const status = screen.getByTestId(TEXTURE_WORK_STATUS_TESTID);
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.textContent).toBe('Building textures…');

    await act(async () => end());
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });

  it('wears the stat chip, which never wraps inside the fixed-height top bar', async () => {
    render(<TextureWorkStatus />);
    let end: () => void = () => {};
    await act(async () => {
      end = textureWork.begin();
    });
    expect(screen.getByTestId(TEXTURE_WORK_STATUS_TESTID).className).toMatch(/statChip/);
    await act(async () => end());

    const css = readFileSync(path.join(import.meta.dirname, 'TscnPreviewShell.module.css'), 'utf8');
    const chip = /\.statChip\s*\{[^}]*\}/.exec(css)?.[0] ?? '';
    expect(chip).toContain('white-space: nowrap');
  });
});
