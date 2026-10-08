/**
 * A CanvasItem's `material` resolves from a SubResource or a `.tres` file, as
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
import { CanvasItemBlendMode } from '../../resources/materials/canvasitemmaterial/types';
import type { Node2DProperties } from '../../nodes/base/node2d/types';
import { useCanvasItemMaterial, useCanvasItemMaterialFile } from './canvasItemMaterialContext';

const ADD_TRES = parseTresFile(`[gd_resource type="CanvasItemMaterial" format=3]

[resource]
blend_mode = 1
`);

const SHADER_TRES = parseTresFile(`[gd_resource type="ShaderMaterial" format=3]

[resource]
`);

const SCENE_EXT: TscnExternalResource[] = [{ id: 'm', type: 'Material', path: 'res://add.tres' }];
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
  return fake;
}

const materialFile = (path: string | null) =>
  renderHook(() => useCanvasItemMaterialFile(path), { wrapper: wrapper(seededLoader()) }).result.current;

describe('useCanvasItemMaterialFile', () => {
  it('reads a CanvasItemMaterial .tres to its properties', () => {
    expect(materialFile('res://add.tres')?.blendMode).toBe(CanvasItemBlendMode.ADD);
  });

  it('gives null for a file that failed to load', () => {
    expect(materialFile('res://gone.tres')).toBeNull();
  });

  it('gives null for another material type, which draws with plain canvas blending', () => {
    expect(materialFile('res://shader.tres')).toBeNull();
  });

  it('gives null for a binary .res, which no processor reads', () => {
    expect(materialFile('res://add.res')).toBeNull();
  });
});

const nodeMaterial = (props: Partial<Node2DProperties>) =>
  renderHook(() => useCanvasItemMaterial(props as Node2DProperties), { wrapper: wrapper(seededLoader()) })
    .result.current;

describe('useCanvasItemMaterial', () => {
  it("reads a node's ExtResource material from its .tres", () => {
    expect(nodeMaterial({ materialPath: 'ExtResource("m")' })?.blendMode).toBe(CanvasItemBlendMode.ADD);
  });

  it("reads a node's SubResource material", () => {
    expect(nodeMaterial({ materialPath: 'SubResource("sub")' })?.blendMode).toBe(CanvasItemBlendMode.SUB);
  });

  it('gives null for an ExtResource id the scene does not declare', () => {
    expect(nodeMaterial({ materialPath: 'ExtResource("missing")' })).toBeNull();
  });
});
