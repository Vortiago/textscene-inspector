import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';
import type { UndrawnNode } from '../../viewStatus/undrawnNodes';
import { SceneNodeHandle } from '../../../scene/nodeHandle';
import { renderInspector } from './inspector.testkit';

/** `Main`, and below it a node of `type` named `name` that sets `properties`. */
function sceneWith(name: string, type: string, properties = ''): string {
  return `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="${name}" type="${type}" parent="."]
${properties}
`;
}

function undrawnAt(path: string, reason: Partial<UndrawnNode>): UndrawnNode {
  return { path, meshTypes: [], isEmptyShape: false, hasNoComponent: false, ...reason };
}

describe('<NodeDetailsPanel>', () => {
  afterEach(() => vi.restoreAllMocks());

  it('shows the empty-state copy when nothing is selected', async () => {
    await renderInspector(sceneWith('Lamp', 'Node3D'), null);
    expect(screen.getByText(/Select a node/i)).toBeTruthy();
  });

  it('shows the name, the class, the path and the parent of the selected node', async () => {
    await renderInspector(sceneWith('Lamp', 'OmniLight3D'), 'Main/Lamp');

    expect(screen.getByRole('heading', { name: 'Lamp' })).toBeTruthy();
    expect(screen.getByText('OmniLight3D')).toBeTruthy();
    expect(screen.getByText('Main/Lamp')).toBeTruthy();
    expect(screen.getByText('Parent:').nextElementSibling?.textContent).toBe('Main');
  });

  it('shows the name and the class of the selected node before its inspection lands', async () => {
    vi.spyOn(SceneNodeHandle.prototype, 'call').mockReturnValue(new Promise(() => undefined));
    await renderInspector(sceneWith('Lamp', 'OmniLight3D'), 'Main/Lamp');

    expect(screen.getByText('OmniLight3D')).toBeTruthy();
  });

  it('shows no Parent row for the scene root', async () => {
    await renderInspector(sceneWith('Lamp', 'Node3D'), 'Main');
    expect(screen.queryByText('Parent:')).toBeNull();
  });

  it('shows the "Not Implemented" banner above the rows for a node the view has no component for', async () => {
    await renderInspector(sceneWith('Ghost', 'Node3D'), 'Main/Ghost', {
      undrawn: [undrawnAt('/root/Main/Ghost', { hasNoComponent: true })],
    });

    expect(screen.getByText('Not Implemented')).toBeTruthy();
    expect(screen.getByText(/not yet drawn/i)).toBeTruthy();
    expect(screen.getByText('Path:')).toBeTruthy();
  });

  it('shows no "Not Implemented" banner for a node the view draws', async () => {
    await renderInspector(sceneWith('Lamp', 'Node3D'), 'Main/Lamp');
    expect(screen.queryByText('Not Implemented')).toBeNull();
  });

  it('names a mesh type the previewer does not draw', async () => {
    await renderInspector(sceneWith('Sign', 'MeshInstance3D'), 'Main/Sign', {
      undrawn: [undrawnAt('/root/Main/Sign', { meshTypes: ['FutureMesh'] })],
    });

    expect(screen.getByText(/Its FutureMesh mesh is not yet drawn/)).toBeTruthy();
  });

  it("shows Godot's empty-shape warning for a shape with an empty brush", async () => {
    await renderInspector(sceneWith('Wall', 'CSGBox3D'), 'Main/Wall', {
      undrawn: [undrawnAt('/root/Main/Wall', { isEmptyShape: true })],
    });

    expect(screen.getByText('The CSGShape3D has an empty shape.')).toBeTruthy();
    expect(screen.getByText('Each edge must be a member of exactly two faces.')).toBeTruthy();
  });

  it('shows no empty-shape warning for a shape that holds a solid', async () => {
    await renderInspector(sceneWith('Wall', 'CSGBox3D'), 'Main/Wall', {
      undrawn: [undrawnAt('/root/Main/Wall', { meshTypes: ['FutureMesh'] })],
    });

    expect(screen.queryByText('The CSGShape3D has an empty shape.')).toBeNull();
  });

  it("shows the rows of the selected class's formatter", async () => {
    await renderInspector(sceneWith('Wait', 'Timer', 'wait_time = 2.5'), 'Main/Wait');

    expect(await screen.findByText('Wait Time (s):')).toBeTruthy();
    expect(screen.getByText('2.50')).toBeTruthy();
  });

  it('reads the rows again after a write to the node', async () => {
    const { scene } = await renderInspector(sceneWith('Wait', 'Timer', 'wait_time = 2.5'), 'Main/Wait');
    await screen.findByText('2.50');

    await act(async () => {
      await scene.getNode('/root/Main/Wait').set('wait_time', 4);
    });

    expect(await screen.findByText('4.00')).toBeTruthy();
  });
});

describe('<NodeDetailsPanel> camera actions', () => {
  async function selectCamera(type: string) {
    await renderInspector(sceneWith('Eye', type), 'Main/Eye', { hasPreviewCamera: true });
  }

  it("offers Godot's Preview checkbox, unchecked, for a Camera3D", async () => {
    await selectCamera('Camera3D');
    expect(((await screen.findByRole('checkbox', { name: 'Preview' })) as HTMLInputElement).checked).toBe(
      false
    );
  });

  it('checks Preview while the viewport previews the camera, and clears it when unchecked', async () => {
    await selectCamera('Camera3D');
    const preview = (await screen.findByRole('checkbox', { name: 'Preview' })) as HTMLInputElement;

    await act(async () => preview.click());
    expect(preview.checked).toBe(true);

    await act(async () => preview.click());
    expect(preview.checked).toBe(false);
  });

  it('offers Preview for a Camera3D subclass, as `is_class` answers for an XRCamera3D', async () => {
    await selectCamera('XRCamera3D');
    expect(await screen.findByRole('checkbox', { name: 'Preview' })).toBeTruthy();
  });

  it('offers no Preview for a node that is no camera', async () => {
    await selectCamera('Node3D');
    expect(screen.queryByRole('checkbox', { name: 'Preview' })).toBeNull();
  });
});

describe('<NodeDetailsPanel> copy node path', () => {
  const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Player" type="Node3D" parent="."]

[node name="Camera3D" type="Camera3D" parent="Player"]
`;

  async function copyFor(selected: string): Promise<ReturnType<typeof vi.fn>> {
    const onCopyNodePath = vi.fn();
    await renderInspector(SCENE, selected, { onCopyNodePath });
    await act(async () => screen.getByRole('button', { name: 'Copy node path' }).click());
    return onCopyNodePath;
  }

  it.each([
    ['the root as "."', 'Root', '.'],
    ['a nested node from the root, without the root name', 'Root/Player/Camera3D', 'Player/Camera3D'],
  ])('asks the host to copy %s', async (_what, selected, expected) => {
    expect(await copyFor(selected)).toHaveBeenCalledExactlyOnceWith(expected);
  });

  it('leaves the Path row as the live path', async () => {
    await copyFor('Root/Player');
    expect(screen.getByText('Root/Player')).toBeTruthy();
  });

  it('has no copy button when the host cannot copy', async () => {
    await renderInspector(SCENE, 'Root');
    expect(screen.queryByRole('button', { name: 'Copy node path' })).toBeNull();
  });
});
