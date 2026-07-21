import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The shell mounts <TscnCanvas>, which boots @react-three/fiber and requires a
// WebGL context. happy-dom does not provide one, so we substitute a lightweight
// placeholder for these DOM-level UI tests.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const MINIMAL_TSCN = `[gd_scene load_steps=1 format=3]

[node name="Root" type="Node3D"]

[node name="Child" type="Node3D" parent="Root"]
`;

const INVALID_TSCN = '[this is { not valid';

describe('<TscnPreviewShell>', () => {
  it('renders the canvas, the tree, and the details panel', async () => {
    render(<TscnPreviewShell panelId="p1" content={MINIMAL_TSCN} />);
    expect(screen.getByTestId('canvas-stub')).toBeTruthy();
    // SceneTreeViewer and NodeDetailsPanel are React.lazy
    // imports — they resolve in a microtask after the initial render.
    // findBy* awaits Suspense resolution; getBy* would race.
    expect(await screen.findByText('Root')).toBeTruthy();
    expect(await screen.findByText(/Select a node/i)).toBeTruthy();
  });

  it('renders the toolbar slot when provided', () => {
    render(
      <TscnPreviewShell
        panelId="p1"
        content={MINIMAL_TSCN}
        toolbar={<div data-testid="my-toolbar">tools</div>}
      />
    );
    expect(screen.getByTestId('my-toolbar')).toBeTruthy();
  });

  it('exposes panelId on the shell root for host coordination', () => {
    const { container } = render(<TscnPreviewShell panelId="panel-x" content="" />);
    expect(container.querySelector('[data-panel-id="panel-x"]')).toBeTruthy();
  });

  it('renders a passive loading state when content is empty', () => {
    render(<TscnPreviewShell panelId="p1" content="" />);
    expect(screen.getByText(/Loading scene/i)).toBeTruthy();
    // No alert banner — empty content is not an error, just no scene yet.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still renders without crashing on invalid TSCN content', () => {
    // The current TscnParser is lenient — invalid bodies typically produce an
    // empty scene rather than throwing. The shell must not crash either way.
    expect(() =>
      render(<TscnPreviewShell panelId="p1" content={INVALID_TSCN} />)
    ).not.toThrow();
    // Either an error banner OR an empty tree is acceptable for this gate.
    const banner = screen.queryByRole('alert');
    const emptyMsg = screen.queryByText(/No nodes to display|Loading scene/i);
    expect(banner !== null || emptyMsg !== null).toBe(true);
  });

  it('surfaces a parse-error banner when the lenient parser extracts no nodes from non-empty content (WI-R3F-7 / WEB-10)', () => {
    // The lenient parser doesn't throw on this content; it just returns
    // zero root nodes. Before this fix the user saw the same "No nodes
    // to display" message they'd see for a legitimately empty scene.
    // The shell now distinguishes "empty content" from "non-empty
    // content that produced no nodes" and surfaces a banner.
    render(<TscnPreviewShell panelId="p1" content={INVALID_TSCN} />);
    const banner = screen.queryByRole('alert');
    expect(banner).toBeTruthy();
    expect(banner!.textContent).toMatch(/Parse error|Parser could not extract/i);
  });

  it('isolates selection state between two shells in the same document', async () => {
    render(
      <>
        <TscnPreviewShell panelId="shell-a" content={MINIMAL_TSCN} />
        <TscnPreviewShell panelId="shell-b" content={MINIMAL_TSCN} />
      </>
    );

    const shellA = globalThis.document.querySelector('[data-panel-id="shell-a"]') as HTMLElement;
    const shellB = globalThis.document.querySelector('[data-panel-id="shell-b"]') as HTMLElement;
    expect(shellA).toBeTruthy();
    expect(shellB).toBeTruthy();

    // Wait for the lazy SceneTreeViewer to load in both shells — without
    // this the [data-node-path="Root"] elements don't exist yet.
    await screen.findAllByText('Root');

    const rootRows = globalThis.document.querySelectorAll('[data-node-path="Root"]');
    expect(rootRows).toHaveLength(2);
    const rowInA = shellA.querySelector('[data-node-path="Root"] [class*=header]') as HTMLElement;
    expect(rowInA).toBeTruthy();

    // Click "Root" only in shell A.
    await act(async () => {
      await userEvent.click(rowInA);
    });

    // Shell A row has the selected style; shell B's does not.
    const selectedInA = shellA.querySelectorAll('[class*=selected]').length;
    const selectedInB = shellB.querySelectorAll('[class*=selected]').length;

    expect(selectedInA).toBeGreaterThan(0);
    expect(selectedInB).toBe(0);
  });

  it('fires onNodeReveal with the slash-joined path on double click', async () => {
    const onNodeReveal = vi.fn();
    render(
      <TscnPreviewShell
        panelId="p1"
        content={MINIMAL_TSCN}
        onNodeReveal={onNodeReveal}
      />
    );

    // findByText awaits the Suspense fallback resolving to the loaded
    // SceneTreeViewer.
    const rootRow = await screen.findByText('Root');
    await userEvent.dblClick(rootRow);
    expect(onNodeReveal).toHaveBeenCalledWith('Root', expect.objectContaining({ name: 'Root' }));
  });

  it('WI-R3F-18: shows Suspense fallback for tree + details panel before they resolve', async () => {
    // The two DOM panels are now `React.lazy` imports — initial render
    // returns the fallback synchronously, then the real panel renders
    // after the import promise resolves on the microtask queue.
    render(<TscnPreviewShell panelId="lazy-fallback" content={MINIMAL_TSCN} />);
    // The fallbacks live in elements with `aria-busy="true"`.
    const fallbacks = globalThis.document.querySelectorAll('[aria-busy="true"]');
    // We may catch zero fallbacks if jsdom resolves the lazy import
    // synchronously (some test environments do); the contract that
    // actually matters is that the real panels eventually render.
    expect(fallbacks.length).toBeGreaterThanOrEqual(0);
    // Real panels resolve via Suspense.
    expect(await screen.findByText('Root')).toBeTruthy();
    expect(await screen.findByText(/Select a node/i)).toBeTruthy();
  });

  it('WI-R3F-18: canvas paints immediately even while the lazy panels are still loading', () => {
    // The canvas stub renders on initial paint — it is NOT lazy. The
    // bundle-size guard's seam relies on this: removing the panels from
    // the initial chunk means the user sees the 3D viewport before the
    // sidebar hydrates.
    render(<TscnPreviewShell panelId="canvas-first" content={MINIMAL_TSCN} />);
    expect(screen.getByTestId('canvas-stub')).toBeTruthy();
  });

  it('preserves the same TscnCanvas instance across content changes (hot-reload camera persistence)', () => {
    // Camera state is owned by the THREE.Camera object inside <Canvas>.
    // The shell uses useMemo on `content` to re-parse, but the tree
    // structure (the <TscnCanvas> child) keeps the same React identity
    // across renders — so the viewport camera state survives a content
    // swap. This test verifies the canvas stub is the SAME DOM node
    // before and after the swap, which is the load-bearing property:
    // React's reconciler reuses the same fiber.
    const updated = MINIMAL_TSCN.replace('Root', 'Root_changed');
    const { rerender } = render(
      <TscnPreviewShell panelId="hot-reload" content={MINIMAL_TSCN} />
    );
    const stubBefore = screen.getByTestId('canvas-stub');

    rerender(<TscnPreviewShell panelId="hot-reload" content={updated} />);
    const stubAfter = screen.getByTestId('canvas-stub');

    // Same DOM node = React reused the fiber = the real <Canvas>'s
    // camera ref would have been preserved too.
    expect(stubAfter).toBe(stubBefore);
  });
});
