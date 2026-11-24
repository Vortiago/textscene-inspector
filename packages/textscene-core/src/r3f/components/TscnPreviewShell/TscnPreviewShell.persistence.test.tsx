/**
 * The shell wires `usePersistedState` to the dock layout and the viewport
 * mode, one field each. usePersistedState.test.ts tests the hook itself.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: ({ show }: { show?: { performance?: boolean } }) => (
    <div data-testid="canvas-stub" data-performance={String(show?.performance)} />
  ),
  TscnSceneContents: () => null,
}));

import { TextShell } from './TscnPreviewShell.testkit';
import { openDisplayMenu } from '../ViewportToolbar/DisplayMenu.testkit';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]
`;

// A plain "Node" root claims neither workspace, so <WorkspaceAutoSelect> does
// not override the mode on mount. The persisted mode is observable only there,
// as Godot derives the workspace per scene tab.
const PLAIN_ROOT_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node"]
`;

describe('<TextShell> persisted dock layout + viewport mode (#224)', () => {
  afterEach(() => {
    globalThis.window.localStorage.clear();
  });

  it('persists dockCollapsed across a remount (simulating a reload)', () => {
    const { unmount } = render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    fireEvent.click(screen.getByLabelText('Collapse the side panel'));
    expect(screen.getByLabelText('Show the side panel')).toBeTruthy();
    unmount();

    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    // A fresh mount reads the persisted "collapsed" state, so it shows the expand control.
    expect(screen.getByLabelText('Show the side panel')).toBeTruthy();
    expect(screen.queryByLabelText('Collapse the side panel')).toBeNull();
  });

  it('asks the view for the performance panel when the last session turned it on', () => {
    globalThis.window.localStorage.setItem('tsi.showPerformance', 'true');
    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByTestId('canvas-stub').dataset.performance).toBe('true');
  });

  it('a session with no persisted value asks for no performance panel (default)', () => {
    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByTestId('canvas-stub').dataset.performance).toBe('false');
  });

  it('a session with no persisted value starts with the dock expanded (default)', () => {
    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByLabelText('Collapse the side panel')).toBeTruthy();
  });

  it('persists the 3D/2D viewport mode across a remount (plain-Node root: WorkspaceAutoSelect has no opinion)', () => {
    const { unmount } = render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
    unmount();

    render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('persists the In-game mode across a remount', () => {
    const { unmount } = render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: 'In-game' }));
    unmount();

    render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: 'In-game' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('persists hidden gizmos across a remount', () => {
    const { unmount } = render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    openDisplayMenu();
    expect((screen.getByRole('checkbox', { name: 'Gizmos' }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gizmos' }));
    unmount();

    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    openDisplayMenu();
    expect((screen.getByRole('checkbox', { name: 'Gizmos' }) as HTMLInputElement).checked).toBe(false);
  });

  it('persists a hidden fog across a remount, so a slow scene stays fast on reload', () => {
    const { unmount } = render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    openDisplayMenu();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fog' }));
    unmount();

    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    openDisplayMenu();
    expect((screen.getByRole('checkbox', { name: 'Fog' }) as HTMLInputElement).checked).toBe(false);
  });

  it('a session with no persisted value shows the fog', () => {
    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    openDisplayMenu();
    expect((screen.getByRole('checkbox', { name: 'Fog' }) as HTMLInputElement).checked).toBe(true);
  });

  it('a session with no persisted value defaults to 3D (matches the pre-#224 baseline)', () => {
    render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a TYPED scene root (Node3D) still wins over a persisted 2D preference — WorkspaceAutoSelect is unchanged', () => {
    const { unmount } = render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    unmount();

    // A Node3D root's claim wins over the persisted preference, as it does over
    // a manual toggle.
    render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
  });

  it("WorkspaceAutoSelect's programmatic mode pick does NOT overwrite the persisted user preference", () => {
    // Auto-select shows 3D for a Node3D scene but writes nothing to storage: only
    // the toolbar click persists. A later plain-Node scene restores the 2D choice.
    const first = render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    fireEvent.click(screen.getByRole('button', { name: '2D' }));
    first.unmount();

    const typed = render(<TextShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true');
    typed.unmount();

    render(<TextShell panelId="p1" content={PLAIN_ROOT_TSCN} />);
    expect(screen.getByRole('button', { name: '2D' }).getAttribute('aria-pressed')).toBe('true');
  });
});
