/**
 * PreviewErrorBoundary (#216) — wraps <ViewportArea> in the shell so a thrown
 * render exception there doesn't blank the whole shell (tree/inspector/toolbar
 * stay usable), and clears the moment a fresh parse hands it a new sceneGraph
 * (the file was fixed) — via resetKeys, NOT a key-driven remount. The
 * "no-regression" half of that contract (the REAL <TscnCanvas> instance
 * surviving a content change) is already pinned by the existing
 * "preserves the same TscnCanvas instance across content changes" test in
 * TscnPreviewShell.test.tsx, which exercises the real (unmocked) ViewportArea
 * — this file only needs to prove PreviewErrorBoundary itself doesn't
 * defeat that by remounting on every scene change.
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

    // The viewport crashed, but the shell chrome around it survived —
    // the panel-id root and the top bar are still there.
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

    // The "fix": the viewport stops crashing AND the content changes (a new
    // sceneGraph reference), mirroring the user editing the file.
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

    // Still crashing, same content — an unrelated prop changes (toolbar);
    // the boundary must stay on the fallback since sceneGraph didn't change.
    rerender(
      <TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} toolbar={<span>hi</span>} />
    );
    expect(screen.getByRole('alert')).toBeTruthy();

    consoleSpy.mockRestore();
    shouldCrash.current = false;
  });
});
