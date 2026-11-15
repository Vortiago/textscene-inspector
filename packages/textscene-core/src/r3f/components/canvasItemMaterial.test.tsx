/**
 * A CanvasItem's `material` resolves from a SubResource or a resource file, as
 * `CanvasItem::set_material` takes any loaded `Ref<Material>` (`canvas_item.cpp:1204-1211`).
 */
import { describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook } from '@testing-library/react';

import { parseTresFile } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { SceneResourcesProvider } from '../SceneResourcesContext';
import { ResourceLoaderProvider } from '../../resources/ResourceLoaderContext';
import {
  createFakeResourceLoader,
  type FakeResourceLoader,
} from '../../resources/testing/createFakeResourceLoader';

import { useSceneResources } from '../SceneResourcesContext';
import { useResolvedCanvasItemMaterial } from './canvasItemMaterial';
import '../../resources/formats/binaryresource/index';
import { CanvasItemMaterialBlendMode } from '../../godot/scene/canvasItemMaterial';

const ADD_TRES = parseTresFile(`[gd_resource type="CanvasItemMaterial" format=3]

[resource]
blend_mode = 1
`);

const SHADER_TRES = parseTresFile(`[gd_resource type="ShaderMaterial" format=3]

[resource]
`);

const SCENE_EXT: TscnExternalResource[] = [
  { id: 'm', type: 'Material', path: 'res://add.tres' },
  { id: 'bin', type: 'Material', path: 'res://add.res' },
  { id: 'shader', type: 'Material', path: 'res://shader.tres' },
  { id: 'gone', type: 'Material', path: 'res://gone.tres' },
  { id: 'png', type: 'Material', path: 'res://add.png' },
];
const SCENE_SUB: TscnInternalResource[] = [
  { id: 'sub', type: 'CanvasItemMaterial', data: { blend_mode: '2' } },
];

function wrapper(fake: FakeResourceLoader) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={SCENE_SUB} externalResources={SCENE_EXT}>
          {children}
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  };
}

function seededLoader(): FakeResourceLoader {
  const fake = createFakeResourceLoader();
  fake.resources.seed('res://add.tres', ADD_TRES);
  fake.resources.seed('res://shader.tres', SHADER_TRES);
  fake.resources.seed('res://gone.tres', null);
  // The binary reader parses a `.res` to the ParsedResource a `.tres` gives.
  fake.resources.seed('res://add.res', ADD_TRES);
  return fake;
}

/** The material a node naming `ref` resolves to in the scene, below a parent that hands down none. */
const nodeMaterial = (ref: string) =>
  renderHook(
    () =>
      useResolvedCanvasItemMaterial({ ref, useParentMaterial: false }, useSceneResources(), { kind: 'none' }),
    { wrapper: wrapper(seededLoader()) }
  ).result.current;

describe('useResolvedCanvasItemMaterial', () => {
  it("reads a node's ExtResource material from its .tres", () => {
    expect(nodeMaterial('ExtResource("m")')?.blendMode).toBe(CanvasItemMaterialBlendMode.ADD);
  });

  it("reads a node's SubResource material", () => {
    expect(nodeMaterial('SubResource("sub")')?.blendMode).toBe(CanvasItemMaterialBlendMode.SUB);
  });

  it("reads a node's ExtResource material from its binary .res", () => {
    expect(nodeMaterial('ExtResource("bin")')?.blendMode).toBe(CanvasItemMaterialBlendMode.ADD);
  });

  it('gives null for an ExtResource id the scene does not declare', () => {
    expect(nodeMaterial('ExtResource("missing")')).toBeNull();
  });

  it('gives null for a material file that failed to load', () => {
    expect(nodeMaterial('ExtResource("gone")')).toBeNull();
  });

  it('gives null for another material type, which draws with plain canvas blending', () => {
    expect(nodeMaterial('ExtResource("shader")')).toBeNull();
  });

  it('gives null for a path no resource file has, such as an image', () => {
    expect(nodeMaterial('ExtResource("png")')).toBeNull();
  });
});
