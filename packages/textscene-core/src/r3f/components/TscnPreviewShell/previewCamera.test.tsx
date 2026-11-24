import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { openScene, type Scene } from '../../../scene/openScene';
import type { ResourceProvider } from '../../../resources/ResourceProvider';
import '../../sceneLiveTree.js';
import { PreviewCameraProvider, usePreviewCamera, viewCameraOf } from './previewCamera';

const NO_FILES: ResourceProvider = { loadResource: async () => null };

const WITH_CAMERA = `[gd_scene format=3]

[node name="Main" type="Node3D"]

[node name="Eye" type="Camera3D" parent="."]
`;

const WITHOUT_CAMERA = `[gd_scene format=3]

[node name="Main" type="Node3D"]
`;

function renderPreview(scene: Scene, initialCamera?: string) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <PreviewCameraProvider scene={scene} initialCamera={initialCamera}>
      {children}
    </PreviewCameraProvider>
  );
  return renderHook(() => usePreviewCamera(), { wrapper }).result;
}

describe('the camera the shell hands its view', () => {
  it('is the editor camera until a panel previews one', () => {
    const preview = renderPreview(openScene({ source: WITH_CAMERA, provider: NO_FILES }));
    expect(preview.current?.camera).toBeNull();

    act(() => preview.current?.previewCamera('Main/Eye'));

    expect(preview.current?.camera).toBe('Main/Eye');
  });

  it('names the camera to the view by its absolute path', () => {
    expect(viewCameraOf('Main/Eye')).toBe('/root/Main/Eye');
    expect(viewCameraOf(null)).toBeNull();
  });

  it('ends the preview when its camera leaves the tree', async () => {
    const scene = openScene({ source: WITH_CAMERA, provider: NO_FILES });
    scene.getNode('/root/Main/Eye');
    const preview = renderPreview(scene, 'Main/Eye');

    await act(async () => scene.setSource(WITHOUT_CAMERA));
    await act(async () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

    expect(preview.current?.camera).toBeNull();
  });

  it('keeps a deep-linked camera that has not entered the tree yet', async () => {
    const scene = openScene({ source: WITHOUT_CAMERA, provider: NO_FILES });
    const preview = renderPreview(scene, 'Main/Later');

    await act(async () => scene.setSource(WITH_CAMERA));
    await act(async () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined))));

    expect(preview.current?.camera).toBe('Main/Later');
  });
});
