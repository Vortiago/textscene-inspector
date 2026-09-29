/**
 * The texture work status sits in the shell's top bar, beside the scene stats,
 * never over the viewport a capture screenshots.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));
vi.mock('../Canvas2DStage/Canvas2DStage', () => ({
  Canvas2DStage: () => <div data-testid="canvas-2d" />,
}));

import { TscnPreviewShell } from './TscnPreviewShell';
import { beginTextureWork } from '../../../resources/textures/textureWork';
import { TEXTURE_WORK_STATUS_TESTID } from './TextureWorkStatus';

const SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n`;

describe('<TscnPreviewShell> texture work status', () => {
  it('shows the status in the top bar while texture work is pending', () => {
    render(<TscnPreviewShell panelId="texture-work" content={SCENE} />);
    let end: () => void = () => {};
    act(() => {
      end = beginTextureWork();
    });

    const status = screen.getByTestId(TEXTURE_WORK_STATUS_TESTID);
    expect(status.closest('header')).not.toBeNull();
    expect(status.closest('main')).toBeNull();

    act(() => end());
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });
});
