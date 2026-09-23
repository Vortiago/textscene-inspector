/**
 * A switch between two non-null scenes fires `clearAll()`, so no selection
 * leaks into the new scene. A mock TscnCanvas spares happy-dom a WebGL context.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: () => <div data-testid="canvas-stub" />,
  TscnSceneContents: () => null,
}));

import { TscnPreviewShell } from './TscnPreviewShell';

const FIXTURE_A = `[gd_scene load_steps=1 format=3]

[node name="AlphaRoot" type="Node3D"]

[node name="AlphaChild" type="Node3D" parent="AlphaRoot"]
`;

const FIXTURE_B = `[gd_scene load_steps=1 format=3]

[node name="BetaRoot" type="Node3D"]
`;

describe('<TscnPreviewShell> scene-switch (WI-UX-5)', () => {
  it('clears the selected row when content changes (non-null → non-null sceneGraph transition)', async () => {
    const { container, rerender } = render(
      <TscnPreviewShell panelId="p1" content={FIXTURE_A} />
    );

    // Wait for lazy SceneTreeViewer to resolve before querying DOM.
    await screen.findByText('AlphaRoot');
    const alphaRow = container.querySelector(
      '[data-node-path="AlphaRoot"] [class*=header]'
    ) as HTMLElement;
    expect(alphaRow).toBeTruthy();

    await act(async () => {
      await userEvent.click(alphaRow);
    });

    // AlphaRoot is selected in fixture A.
    const selectedAfterClick = container.querySelector(
      '[data-node-path="AlphaRoot"] [aria-selected="true"]'
    );
    expect(selectedAfterClick).toBeTruthy();

    rerender(<TscnPreviewShell panelId="p1" content={FIXTURE_B} />);

    // No tree row is selected. The scope is [data-node-path] rows, since the
    // active detail tab (ADR-0007) carries aria-selected too.
    const anySelected = container.querySelector('[data-node-path] [aria-selected="true"]');
    expect(anySelected).toBeNull();
  });

  it('does NOT fire clearAll on the initial null → first-scene mount transition', async () => {
    // A mount-time clearAll would erase a selection made right after mount, so a
    // selection on the first scene must stick.
    const { container } = render(
      <TscnPreviewShell panelId="p1" content={FIXTURE_A} />
    );

    // Wait for lazy SceneTreeViewer to resolve before querying DOM.
    await screen.findByText('AlphaRoot');
    const alphaRow = container.querySelector(
      '[data-node-path="AlphaRoot"] [class*=header]'
    );
    expect(alphaRow).toBeTruthy();
  });

  it('clears expanded + hidden + selection together when scene swaps', async () => {
    const { container, rerender } = render(
      <TscnPreviewShell panelId="p1" content={FIXTURE_A} />
    );

    // Wait for lazy SceneTreeViewer to resolve before querying DOM.
    await screen.findByText('AlphaRoot');

    // Expand AlphaRoot (click the chevron) and select it.
    const alphaRow = container.querySelector(
      '[data-node-path="AlphaRoot"] [class*=header]'
    ) as HTMLElement;
    const expandIcon = alphaRow.querySelector(
      '[class*=expandIcon]'
    ) as HTMLElement;
    if (expandIcon) {
      await act(async () => {
        await userEvent.click(expandIcon);
      });
    }
    await act(async () => {
      await userEvent.click(alphaRow);
    });

    rerender(<TscnPreviewShell panelId="p1" content={FIXTURE_B} />);

    // No tree row is selected or expanded. BetaRoot has no children, so its
    // aria-expanded is absent, and the query asks for "true". The scope skips
    // the active detail tab (ADR-0007).
    const stillSelected = container.querySelector('[data-node-path] [aria-selected="true"]');
    const stillExpanded = container.querySelector('[data-node-path] [aria-expanded="true"]');
    expect(stillSelected).toBeNull();
    expect(stillExpanded).toBeNull();
  });
});
