/**
 * A Button-family painter's own `icon` property in a test: a seeded Texture2D resource, the providers
 * that resolve it, and the quads it draws. `OWN_ICON_REF` and `OWN_ICON_SCOPE` go on the solve node.
 */
import type { ReactElement } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { SceneResourcesProvider } from '../../../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';

const OWN_ICON_PATH = 'res://icon.png';

export const OWN_ICON_REF = 'ExtResource("1")';

export const OWN_ICON_SCOPE = {
  externalResources: [{ id: '1', type: 'Texture2D', path: OWN_ICON_PATH }],
  internalResources: [],
};

/** Renders `painter` with `OWN_ICON_REF` resolving to a texture of `iconSize`. */
export function renderWithOwnIcon(painter: ReactElement, iconSize: { w: number; h: number }) {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: { width: number; height: number } }).image = {
    width: iconSize.w,
    height: iconSize.h,
  };
  fake.textures.seed(OWN_ICON_PATH, texture);
  return ReactThreeTestRenderer.create(
    <ResourceLoaderProvider loader={fake.loader}>
      <SceneResourcesProvider externalResources={OWN_ICON_SCOPE.externalResources}>
        {painter}
      </SceneResourcesProvider>
    </ResourceLoaderProvider>
  );
}

/** Every icon quad, in draw order. A `ControlQuad` is a `PlaneGeometry`, which `instanceof` misses across two three.js copies, so `.parameters.width` finds it. */
export function findIconMeshes(scene: Awaited<ReturnType<typeof renderWithOwnIcon>>['scene']): THREE.Mesh[] {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter(
      (m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined
    );
}
