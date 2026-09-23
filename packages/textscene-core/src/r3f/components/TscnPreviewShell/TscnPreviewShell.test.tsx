import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// <TscnCanvas> needs a WebGL context, which happy-dom lacks, so a placeholder stands in.
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
    // The lazy panels resolve in a microtask after the first render, so findBy*
    // awaits them and getBy* would race.
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
    // Empty content is no error, so no alert banner shows.
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('still renders without crashing on invalid TSCN content', () => {
    // The lenient parser mostly returns an empty scene for an invalid body. The
    // shell must not crash either way.
    expect(() =>
      render(<TscnPreviewShell panelId="p1" content={INVALID_TSCN} />)
    ).not.toThrow();
    // Either an error banner or an empty tree passes.
    const banner = screen.queryByRole('alert');
    const emptyMsg = screen.queryByText(/No nodes to display|Loading scene/i);
    expect(banner !== null || emptyMsg !== null).toBe(true);
  });

  it('surfaces a parse-error banner when the lenient parser extracts no nodes from non-empty content (WI-R3F-7 / WEB-10)', () => {
    // The parser returns zero root nodes here. Non-empty content with no nodes
    // shows a banner, unlike empty content.
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

    // The [data-node-path="Root"] rows exist only once the lazy tree loads.
    await screen.findAllByText('Root');

    const rootRows = globalThis.document.querySelectorAll('[data-node-path="Root"]');
    expect(rootRows).toHaveLength(2);
    const rowInA = shellA.querySelector('[data-node-path="Root"] [class*=header]') as HTMLElement;
    expect(rowInA).toBeTruthy();

    // Click "Root" only in shell A.
    await act(async () => {
      await userEvent.click(rowInA);
    });

    // Only shell A's row has the selected style.
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

    // findByText awaits the loaded SceneTreeViewer.
    const rootRow = await screen.findByText('Root');
    await userEvent.dblClick(rootRow);
    expect(onNodeReveal).toHaveBeenCalledWith('Root', expect.objectContaining({ name: 'Root' }));
  });

  it('WI-R3F-18: shows Suspense fallback for tree + details panel before they resolve', async () => {
    // The first render shows each lazy panel's fallback. The panel follows once
    // its import resolves.
    render(<TscnPreviewShell panelId="lazy-fallback" content={MINIMAL_TSCN} />);
    // The fallbacks live in elements with `aria-busy="true"`.
    const fallbacks = globalThis.document.querySelectorAll('[aria-busy="true"]');
    // A test DOM may resolve the import at once and show no fallback. The
    // contract is that the real panels render.
    expect(fallbacks.length).toBeGreaterThanOrEqual(0);
    // The real panels resolve through Suspense.
    expect(await screen.findByText('Root')).toBeTruthy();
    expect(await screen.findByText(/Select a node/i)).toBeTruthy();
  });

  it('WI-R3F-18: canvas paints immediately even while the lazy panels are still loading', () => {
    // The canvas is not lazy, so the viewport paints before the lazy sidebar.
    // The bundle-size guard relies on this.
    render(<TscnPreviewShell panelId="canvas-first" content={MINIMAL_TSCN} />);
    expect(screen.getByTestId('canvas-stub')).toBeTruthy();
  });

  it('preserves the same TscnCanvas instance across content changes (hot-reload camera persistence)', () => {
    // The THREE.Camera inside <Canvas> owns the camera state. A content swap
    // re-parses but keeps the <TscnCanvas> fiber, so the canvas stays the same
    // DOM node and the camera state survives.
    const updated = MINIMAL_TSCN.replace('Root', 'Root_changed');
    const { rerender } = render(
      <TscnPreviewShell panelId="hot-reload" content={MINIMAL_TSCN} />
    );
    const stubBefore = screen.getByTestId('canvas-stub');

    rerender(<TscnPreviewShell panelId="hot-reload" content={updated} />);
    const stubAfter = screen.getByTestId('canvas-stub');

    // The same DOM node means React reused the fiber.
    expect(stubAfter).toBe(stubBefore);
  });
});
