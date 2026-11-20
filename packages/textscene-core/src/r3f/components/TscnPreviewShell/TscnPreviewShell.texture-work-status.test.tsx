/**
 * The texture work status sits in the shell's top bar, beside the scene stats,
 * never over the viewport a capture screenshots.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ mode }: { mode?: string }) => (
    <div data-testid={mode === '2D' ? 'canvas-2d' : 'canvas-stub'} />
  ),
  TscnSceneContents: () => null,
}));

import { TextShell } from './TscnPreviewShell.testkit';
import { textureWork } from '../../../resources/textures/textureWork';
import { TEXTURE_WORK_STATUS_TESTID } from './statusTestIds';

const SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n`;

describe('<TextShell> texture work status', () => {
  it('shows the status in the top bar while texture work is pending', async () => {
    render(<TextShell panelId="texture-work" content={SCENE} />);
    let end: () => void = () => {};
    await act(async () => {
      end = textureWork.begin();
    });

    const status = screen.getByTestId(TEXTURE_WORK_STATUS_TESTID);
    expect(status.closest('header')).not.toBeNull();
    expect(status.closest('main')).toBeNull();

    await act(async () => end());
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });
});
