/**
 * The texture work status sits in the shell's top bar, beside the scene stats,
 * never over the viewport a capture screenshots.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';

import type { ViewStatus } from '../../viewStatus/viewStatus';

/** The shell's `onStatusChange`, which the stub view hands the test. Written as the stub renders. */
let reportStatus: ((status: ViewStatus) => void) | undefined;

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ onStatusChange }: { onStatusChange?: (status: ViewStatus) => void }) => {
    reportStatus = onStatusChange;
    return <div data-testid="canvas-stub" />;
  },
  TscnSceneContents: () => null,
}));

import { TextShell } from './TscnPreviewShell.testkit';
import { TEXTURE_WORK_STATUS_TESTID } from './statusTestIds';

function statusBuilding(textures: number): ViewStatus {
  return {
    settled: null,
    pending: { textures, fonts: 0 },
    frame: null,
    undrawn: [],
    isSoftwareRendering: false,
  };
}

const SCENE = `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n`;

describe('<TextShell> texture work status', () => {
  it('shows the status in the top bar while the view builds a texture', () => {
    render(<TextShell panelId="texture-work" content={SCENE} />);
    act(() => reportStatus!(statusBuilding(1)));

    const status = screen.getByTestId(TEXTURE_WORK_STATUS_TESTID);
    expect(status.closest('header')).not.toBeNull();
    expect(status.closest('main')).toBeNull();

    act(() => reportStatus!(statusBuilding(0)));
    expect(screen.queryByTestId(TEXTURE_WORK_STATUS_TESTID)).toBeNull();
  });
});
