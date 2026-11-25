import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// happy-dom has no WebGL, and the eye writes the scene, not the view.
vi.mock('../../TscnCanvas', () => ({ TscnCanvas: () => null }));

import { openScene, type Scene } from '../../../scene/openScene';
import { TscnPreviewShell } from './TscnPreviewShell';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="Node3D" parent="."]

[node name="Hidden" type="Sprite2D" parent="."]
visible = false

[node name="Plain" type="Node" parent="."]
`;

const LAYERED_SCENE = `[gd_scene format=3]

[node name="Main" type="Node2D"]

[node name="Layer" type="CanvasLayer" parent="."]
visible = false

[node name="Direct" type="Sprite2D" parent="Layer"]

[node name="Holder" type="Node" parent="Layer"]

[node name="Below" type="Sprite2D" parent="Layer/Holder"]
`;

const TABS_SCENE = `[gd_scene format=3]

[node name="Tabs" type="TabContainer"]

[node name="First" type="Control" parent="."]

[node name="Second" type="Control" parent="."]
`;

const FOLD_SCENE = `[gd_scene format=3]

[node name="Fold" type="FoldableContainer"]

[node name="Inner" type="Control" parent="."]
`;

const labelOf = (path: string) => eyeOf(path)?.getAttribute('aria-label');

function isDimmed(path: string): boolean {
  return eyeOf(path)!.className.includes('underHidden');
}

function eyeOf(path: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `[data-node-path="${path}"] > [role="treeitem"] button[aria-label$=" node"]`
  );
}

async function renderShell(source = SCENE): Promise<Scene> {
  const scene = openScene({ source, provider: { loadResource: async () => null } });
  render(<TscnPreviewShell panelId="eye" scene={scene} initialViewportMode="3D" />);
  fireEvent.click(await screen.findByRole('button', { name: 'Expand all' }));
  return scene;
}

async function clickEye(path: string): Promise<void> {
  await act(async () => {
    fireEvent.click(eyeOf(path)!);
  });
}

// The eye calls set_visible (scene_tree_editor.cpp:241-247) and shows the node's own visible (:608-613).
describe('<TscnPreviewShell> the eye of a tree row', () => {
  it('writes visible = false to a shown node', async () => {
    const scene = await renderShell();

    await clickEye('Main/Box');

    expect(await scene.getNode('/root/Main/Box').get('visible')).toBe(false);
  });

  it('writes visible = true to a node the file hides', async () => {
    const scene = await renderShell();

    await clickEye('Main/Hidden');

    expect(await scene.getNode('/root/Main/Hidden').get('visible')).toBe(true);
  });

  it("shows the node's own visible from the file", async () => {
    await renderShell();

    expect(eyeOf('Main/Hidden')?.getAttribute('aria-label')).toBe('Show node');
    expect(eyeOf('Main/Box')?.getAttribute('aria-label')).toBe('Hide node');
  });

  it('shows the written visible after a click', async () => {
    await renderShell();

    await clickEye('Main/Box');

    // The scene tells its readers of a write on the next frame.
    await vi.waitFor(() => expect(eyeOf('Main/Box')?.getAttribute('aria-label')).toBe('Show node'));
  });

  it("reads no other row's visible after a click", async () => {
    const scene = await renderShell();
    const boxRead = vi.spyOn(scene.getNode('/root/Main/Box'), 'get');

    await clickEye('Main/Hidden');

    await vi.waitFor(() => expect(labelOf('Main/Hidden')).toBe('Hide node'));
    expect(boxRead).not.toHaveBeenCalledWith('visible');
  });

  it('has no eye on a node with no visible', async () => {
    await renderShell();

    expect(eyeOf('Main/Plain')).toBeNull();
  });

  it('opens every eye again when a new text replaces the writes', async () => {
    const scene = await renderShell();
    await clickEye('Main/Box');

    await vi.waitFor(() => expect(eyeOf('Main/Box')?.getAttribute('aria-label')).toBe('Show node'));

    await act(async () => scene.setSource(`${SCENE}\n`));
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));

    expect(eyeOf('Main/Box')?.getAttribute('aria-label')).toBe('Hide node');
  });

  it('dims the eye of a direct child of a hidden CanvasLayer (canvas_item.cpp:326-328)', async () => {
    await renderShell(LAYERED_SCENE);

    expect(isDimmed('Main/Layer/Direct')).toBe(true);
  });

  it('leaves the eye of a CanvasItem below a plain Node under a hidden CanvasLayer (canvas_item.cpp:330-346)', async () => {
    await renderShell(LAYERED_SCENE);

    expect(isDimmed('Main/Layer/Holder/Below')).toBe(false);
  });

  it('shows a TabContainer page that is not current as hidden (tab_container.cpp:377-399)', async () => {
    await renderShell(TABS_SCENE);

    expect(labelOf('Tabs/First')).toBe('Hide node');
    expect(labelOf('Tabs/Second')).toBe('Show node');
  });

  it('makes a shown TabContainer page current (tab_container.cpp:619-620)', async () => {
    await renderShell(TABS_SCENE);

    await clickEye('Tabs/Second');

    await vi.waitFor(() => expect(labelOf('Tabs/Second')).toBe('Hide node'));
    expect(labelOf('Tabs/First')).toBe('Show node');
  });

  it('cannot keep a child of an unfolded FoldableContainer hidden (foldable_container.cpp:375-380)', async () => {
    const scene = await renderShell(FOLD_SCENE);

    await clickEye('Fold/Inner');

    expect(await scene.getNode('/root/Fold/Inner').get('visible')).toBe(true);
    expect(labelOf('Fold/Inner')).toBe('Hide node');
  });
});
