import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { NodeHandle } from '../../../scene/nodeHandle';

/** What the stub view last received, and the `onSelect` it would call on a click. */
const view = vi.hoisted(() => ({
  selected: undefined as NodeHandle | null | undefined,
  onSelect: undefined as ((node: NodeHandle | null) => void) | undefined,
}));

// happy-dom has no WebGL. The stub keeps what the shell hands its view.
vi.mock('../../TscnCanvas', () => ({
  TscnCanvas: (props: { selected?: NodeHandle | null; onSelect?: (node: NodeHandle | null) => void }) => {
    view.selected = props.selected;
    view.onSelect = props.onSelect;
    return null;
  },
  TscnSceneContents: () => null,
}));

import { openScene } from '../../../scene/openScene';
import type { TscnPreviewShellProps } from './previewShellProps';
import { TscnPreviewShell } from './TscnPreviewShell';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="Node3D" parent="."]
`;

const WITHOUT_BOX = `[gd_scene format=3]

[node name="Main" type="Node3D"]
`;

function row(path: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(`[data-node-path="${path}"] > [role="treeitem"]`);
  if (!found) throw new Error(`expected a row for ${path}, found none`);
  return found;
}

async function renderShell(props: Partial<TscnPreviewShellProps> = {}) {
  const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
  render(<TscnPreviewShell panelId="select" scene={scene} initialViewportMode="3D" {...props} />);
  fireEvent.click(await screen.findByRole('button', { name: 'Expand all' }));
  return scene;
}

describe('<TscnPreviewShell> the selection it hands its view', () => {
  it('hands the view the node of a clicked tree row', async () => {
    await renderShell();

    fireEvent.click(row('Main/Box'));

    expect(view.selected?.path).toBe('/root/Main/Box');
  });

  it("selects the tree row of the node the view's click picks", async () => {
    const scene = await renderShell();

    act(() => view.onSelect?.(scene.getNode('/root/Main/Box')));

    expect(row('Main/Box').getAttribute('aria-selected')).toBe('true');
  });

  it('hands the view null after Escape', async () => {
    await renderShell();
    fireEvent.click(row('Main/Box'));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(view.selected).toBeNull();
  });

  // Godot drops a node from the editor selection as it leaves the tree (editor_data.cpp:1216, 1249).
  it('hands the view null once the selected node leaves the tree', async () => {
    const scene = await renderShell();
    fireEvent.click(row('Main/Box'));

    await act(async () => scene.setSource(WITHOUT_BOX));

    expect(view.selected).toBeNull();
  });

  it("hands the view the host's selection, and tells the host of a row click", async () => {
    const onSelect = vi.fn();
    await renderShell({ selected: null, onSelect });

    fireEvent.click(row('Main/Box'));

    expect(onSelect.mock.calls[0]?.[0]?.path).toBe('/root/Main/Box');
    expect(view.selected).toBeNull();
  });
});
