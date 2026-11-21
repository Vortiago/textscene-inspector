import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

// happy-dom has no WebGL, and the eye writes the scene, not the view.
vi.mock('../../TscnCanvas', () => ({ TscnCanvas: () => null, TscnSceneContents: () => null }));

import { openScene, type Scene } from '../../../scene/openScene';
import { TscnPreviewShell } from './TscnPreviewShell';

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Box" type="Node3D" parent="."]

[node name="Hidden" type="Sprite2D" parent="."]
visible = false

[node name="Plain" type="Node" parent="."]
`;

function eyeOf(path: string): HTMLButtonElement | null {
  return document.querySelector<HTMLButtonElement>(
    `[data-node-path="${path}"] > [role="treeitem"] button[aria-label$=" node"]`
  );
}

async function renderShell(): Promise<Scene> {
  const scene = openScene({ source: SCENE, provider: { loadResource: async () => null } });
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
});
