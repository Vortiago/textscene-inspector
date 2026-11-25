import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CamerasPanel } from './CamerasPanel';
import { PreviewCameraProvider, usePreviewCamera } from './previewCamera';
import { HierarchyProvider } from '../../contexts/HierarchyContext';
import { ViewportModeProvider, useViewportMode } from '../ViewportMode/ViewportModeContext';
import type { ViewportMode } from '../../viewportMode';
import { openScene, type Scene } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import '../../sceneLiveTree.js';

const provider: ResourceProvider = { loadResource: async () => null };

const SCENE = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Front" type="Camera3D" parent="."]

[node name="Side" type="Camera3D" parent="."]

[node name="Left" type="Camera2D" parent="."]

[node name="Right" type="Camera2D" parent="."]

[node name="Off" type="Camera2D" parent="."]
enabled = false
`;

function Probe() {
  const { mode, setMode } = useViewportMode();
  const camera = usePreviewCamera()?.camera;
  return (
    <div data-testid="probe" data-mode={mode} data-preview={camera ?? ''}>
      <button type="button" onClick={() => setMode('2D')}>
        2D
      </button>
    </div>
  );
}

async function renderPanel(mode: ViewportMode, source = SCENE): Promise<Scene> {
  const scene = openScene({ source, provider });
  render(
    <HierarchyProvider value={{ sceneGraph: scene.written(), panelId: 'cams-in-game', scene }}>
      <PreviewCameraProvider scene={scene}>
        <ViewportModeProvider initialMode={mode}>
          <Probe />
          <CamerasPanel />
        </ViewportModeProvider>
      </PreviewCameraProvider>
    </HierarchyProvider>
  );
  // Each row waits on its `is_class` read: every camera of these scenes has a row once the reads land.
  const editorRows = mode === 'in-game' ? 0 : 1;
  await waitFor(() =>
    expect(screen.queryAllByRole('button', { name: /^(?!2D$)/ })).toHaveLength(
      scene.cameras().size + editorRows
    )
  );
  return scene;
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const isActive = (name: string) => row(name).getAttribute('data-active') === 'true';
const probe = () => screen.getByTestId('probe');

const TWIN_BOOTHS = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="A" type="Node" parent="."]

[node name="Booth" type="SubViewport" parent="A"]

[node name="Near" type="Camera3D" parent="A/Booth"]

[node name="B" type="Node" parent="."]

[node name="Booth" type="SubViewport" parent="B"]

[node name="Near" type="Camera3D" parent="B/Booth"]
`;

describe('<CamerasPanel> in the In-game mode', () => {
  it('names the whole path of a SubViewport, so two viewports of one name differ', async () => {
    await renderPanel('in-game', TWIN_BOOTHS);
    const tags = screen.getAllByRole('button', { name: /^Near/ }).map((button) => button.textContent);
    expect(tags).toEqual(['Nearcurrent · Main/A/Booth', 'Nearcurrent · Main/B/Booth']);
  });

  it('marks the current Camera3D and Camera2D of the root viewport', async () => {
    await renderPanel('in-game');
    expect([isActive('Front'), isActive('Side'), isActive('Left'), isActive('Right')]).toEqual([
      true,
      false,
      true,
      false,
    ]);
  });

  it('lists no editor camera, since the running game has none', async () => {
    await renderPanel('in-game');
    expect(screen.queryByRole('button', { name: /^Editor camera/ })).toBeNull();
  });

  it('makes a clicked Camera3D current and stays in the In-game mode', async () => {
    const scene = await renderPanel('in-game');
    fireEvent.click(row('Side'));
    await waitFor(() => expect(scene.currentCamera3D(null)).toBe('Main/Side'));
    await waitFor(() => expect(isActive('Side')).toBe(true));
    expect(probe().getAttribute('data-mode')).toBe('in-game');
  });

  it('makes a clicked Camera2D current and stays in the In-game mode', async () => {
    const scene = await renderPanel('in-game');
    fireEvent.click(row('Right'));
    await waitFor(() => expect(scene.currentCamera2D(null)).toBe('Main/Right'));
    await waitFor(() => expect(isActive('Right')).toBe(true));
    expect(probe().getAttribute('data-mode')).toBe('in-game');
  });

  // `make_current` refuses a Camera2D that is not enabled (`camera_2d.cpp:585`).
  it('offers no click on a Camera2D that is not enabled', async () => {
    await renderPanel('in-game');
    expect((row('Off') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers no click on a Camera2D that outside code disables', async () => {
    const scene = await renderPanel('in-game');
    await act(() => scene.getNode('Right').set('enabled', false));
    expect((row('Right') as HTMLButtonElement).disabled).toBe(true);
  });

  it('marks a camera that outside code makes current', async () => {
    const scene = await renderPanel('in-game');
    await act(() => scene.getNode('Side').call('make_current'));
    expect(isActive('Side')).toBe(true);
    expect(isActive('Front')).toBe(false);
  });

  it('leaves the editor preview alone', async () => {
    const scene = await renderPanel('in-game');
    fireEvent.click(row('Side'));
    await waitFor(() => expect(scene.currentCamera3D(null)).toBe('Main/Side'));
    expect(probe().getAttribute('data-preview')).toBe('');
  });
});

describe('<CamerasPanel> in the 2D mode', () => {
  it('opens the 3D view to preview a clicked Camera3D, as a Camera2D opens the 2D view', async () => {
    await renderPanel('2D');
    fireEvent.click(row('Side'));
    expect(probe().getAttribute('data-mode')).toBe('3D');
    expect(probe().getAttribute('data-preview')).toBe('Main/Side');
  });
});

describe('<CamerasPanel> in the 2D mode, after a preview', () => {
  it('marks no Camera3D, since the 2D view draws through none', async () => {
    await renderPanel('2D');
    fireEvent.click(row('Side'));
    fireEvent.click(screen.getByRole('button', { name: /^2D$/ }));
    expect(isActive('Side')).toBe(false);
  });

  it('keeps the 2D view on the editor camera row, whose camera there is a Camera2D', async () => {
    await renderPanel('2D');
    fireEvent.click(row('Editor camera'));
    expect(probe().getAttribute('data-mode')).toBe('2D');
    expect(isActive('Editor camera')).toBe(true);
  });
});

describe('<CamerasPanel> in a scene with no camera', () => {
  const NO_CAMERA = '[gd_scene format=3]\n\n[node name="Main" type="Node3D"]\n';

  it.each(['3D', '2D'] as const)('lists the editor camera alone in the %s mode', async (mode) => {
    await renderPanel(mode, NO_CAMERA);
    expect(screen.getAllByRole('button', { name: /Editor camera/ })).toHaveLength(1);
    expect(screen.queryByText('No camera nodes in this scene.')).toBeNull();
  });

  it('says so in the In-game mode, which has no editor camera', async () => {
    await renderPanel('in-game', NO_CAMERA);
    expect(screen.getByText('No camera nodes in this scene.')).toBeTruthy();
  });
});

describe('<CamerasPanel> in the 3D mode', () => {
  it('previews a clicked Camera3D and leaves the current camera of the game', async () => {
    const scene = await renderPanel('3D');
    fireEvent.click(row('Side'));
    expect(probe().getAttribute('data-preview')).toBe('Main/Side');
    expect(scene.currentCamera3D(null)).toBe('Main/Front');
  });
});
