/**
 * A render error in <ViewportArea> leaves the rest of the shell usable, and a
 * new sceneGraph clears it through resetKeys, not a remount. TscnPreviewShell.test.tsx
 * pins that <TscnCanvas> survives a content change.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { shouldCrash } = vi.hoisted(() => ({ shouldCrash: { current: false } }));

vi.mock('./ViewportArea', () => ({
  ViewportArea: () => {
    if (shouldCrash.current) throw new Error('viewport render exploded');
    return <div data-testid="viewport-stub" />;
  },
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

const OTHER_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Other" type="Node3D"]
`;

describe('<TscnPreviewShell> PreviewErrorBoundary (#216)', () => {
  it('renders the viewport normally when nothing throws', () => {
    shouldCrash.current = false;
    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByTestId('viewport-stub')).toBeTruthy();
  });

  it('catches a crash in the viewport and shows a fallback instead of blanking the whole shell', () => {
    shouldCrash.current = true;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);

    // The viewport crashed, but the panel-id root and the top bar survive.
    expect(globalThis.document.querySelector('[data-panel-id="p1"]')).toBeTruthy();
    expect(screen.queryByTestId('viewport-stub')).toBeNull();
    expect(screen.getByRole('alert')).toBeTruthy();

    consoleSpy.mockRestore();
    shouldCrash.current = false;
  });

  it('clears the caught error once a NEW scene parses successfully (resetKeys)', () => {
    shouldCrash.current = true;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('alert')).toBeTruthy();

    // The user fixes the file: the viewport stops crashing and sceneGraph changes.
    shouldCrash.current = false;
    rerender(<TscnPreviewShell panelId="p1" content={OTHER_TSCN} />);

    expect(screen.getByTestId('viewport-stub')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();

    consoleSpy.mockRestore();
  });

  it('does NOT clear on a re-render that keeps the SAME content (no new sceneGraph)', () => {
    shouldCrash.current = true;
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('alert')).toBeTruthy();

    // Only an unrelated prop changes, so the boundary stays on the fallback.
    rerender(
      <TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} toolbar={<span>hi</span>} />
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    consoleSpy.mockRestore();
    shouldCrash.current = false;
  });
});
