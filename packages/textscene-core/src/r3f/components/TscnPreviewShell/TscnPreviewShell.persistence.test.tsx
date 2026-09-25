/**
 * The shell wires `usePersistedState` to the dock layout and the viewport
 * mode, one field each. usePersistedState.test.ts tests the hook itself.
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

// A plain "Node" root claims neither workspace, so <WorkspaceAutoSelect> does
// not override the mode on mount. The persisted mode is observable only there,
// as Godot derives the workspace per scene tab.
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
    // A fresh mount reads the persisted "collapsed" state, so it shows the expand control.
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

    // A Node3D root's claim wins over the persisted preference, as it does over
    // a manual toggle.
    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it("WorkspaceAutoSelect's programmatic mode pick does NOT overwrite the persisted user preference", () => {
    // Auto-select shows 3D for a Node3D scene but writes nothing to storage: only
    // the toolbar click persists. A later plain-Node scene restores the 2D choice.
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
