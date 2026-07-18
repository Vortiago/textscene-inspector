/**
 * Persisted dock layout + viewport mode. `usePersistedState` itself
 * is unit-tested in isolation (usePersistedState.test.ts); this file only
 * proves the SHELL actually wires it up — a representative field from each
 * (dockCollapsed for layout, viewport mode for ViewportModeContext) rather
 * than exhaustively re-testing every dock field, which would just be
 * re-testing the same already-proven hook mechanics.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

// A PLAIN "Node" root claims neither workspace (workspaceForRoot returns
// null for a container type), so <WorkspaceAutoSelect> — Godot-editor
// parity: auto-picks 2D/3D from a TYPED root, once per scene — does not
// override the mode on mount. That auto-select behavior is deliberate and
// pre-existing; the persisted-mode restoration below is only observable
// where it doesn't have an opinion, exactly like Godot itself re-deriving
// per scene tab rather than remembering a global 2D/3D preference.
const PLAIN_ROOT_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node"]
`;

describe('<TscnPreviewShell> persisted dock layout + viewport mode (#224)', () => {
  afterEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('persists dockCollapsed across a remount (simulating a reload)', () => {
    const { unmount } = render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    fireEvent.click(screen.getByLabelText('Collapse the side panel'));
    expect(screen.getByLabelText('Show the side panel')).toBeTruthy();
    unmount();

    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    // A fresh mount that reads the persisted "collapsed" state starts
    // collapsed too — the expand affordance is present, not the collapse one.
    expect(screen.getByLabelText('Show the side panel')).toBeTruthy();
    expect(screen.queryByLabelText('Collapse the side panel')).toBeNull();
  });

  it('a session with no persisted value starts with the dock expanded (default)', () => {
    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByLabelText('Collapse the side panel')).toBeTruthy();
  });

  it('persists the 3D/2D viewport mode across a remount (plain-Node root: WorkspaceAutoSelect has no opinion)', () => {
    const { unmount } = render(<TscnPreviewShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
    unmount();

    render(<TscnPreviewShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a session with no persisted value defaults to 3D (matches the pre-#224 baseline)', () => {
    render(<TscnPreviewShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a TYPED scene root (Node3D) still wins over a persisted 2D preference — WorkspaceAutoSelect is unchanged', () => {
    const { unmount } = render(<TscnPreviewShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    unmount();

    // Load a Node3D-rooted scene next — WorkspaceAutoSelect's Godot-editor
    // parity claim (typed root -> its workspace, every scene) takes
    // precedence over the persisted preference, exactly as it did before
    // #224 for a manually-toggled mode.
    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it("WorkspaceAutoSelect's programmatic mode pick does NOT overwrite the persisted user preference", () => {
    // Persist an explicit 2D choice, then visit a typed Node3D scene: the
    // auto-select shows 3D for THAT scene (previous test) but must not write
    // 3D into storage — only the toolbar's explicit click persists. A later
    // plain-Node scene (where auto-select has no opinion) restores the 2D
    // preference the user actually made.
    const first = render(<TscnPreviewShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    first.unmount();

    const typed = render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
    typed.unmount();

    render(<TscnPreviewShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
  });
});
