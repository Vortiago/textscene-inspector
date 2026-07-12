/**
 * ArrayMesh processor — fetches a Godot ArrayMesh .tres through the
 * FileEventBus and emits a THREE.BufferGeometry on the 'arraymesh' bus slot.
 */
import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { ResourceEventBus } from '../ResourceEventBus';
import type { FileEventBus, FileData } from '../FileEventBus';
import { createArrayMeshProcessor, type ArrayMeshResource } from './createArrayMeshProcessor';

const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[resource]
_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 1.001358e-05),
"attribute_data": PackedByteArray("AAAAAAAAgD4AAIA+AACAPgAAgD4AAAAAAAAAAAAAAAA="),
"format": 34359742487,
"index_count": 6,
"index_data": PackedByteArray("AgAAAAMAAgABAAAA"),
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/AACAPwAAgD8AAIA/AACAvwAAgD8AAIA//3//f////7//f/9/////v/9//3////+//3//f////78=")
}]
blend_shape_mode = 0
`;

function mockFileBus() {
  const handlers = {
    loaded: new Set<(p: string, d: FileData) => void>(),
    failed: new Set<(p: string, e: Error) => void>(),
  };
  const request = vi.fn();
  const bus = {
    on: (event: 'loaded' | 'failed', h: never) => handlers[event].add(h),
    off: (event: 'loaded' | 'failed', h: never) => handlers[event].delete(h),
    request,
    // createResourceProcessor drops the raw-bytes cache entry once
    // processing settles (success or failure), so a stand-in FileEventBus
    // must implement clearCache() too.
    clearCache: vi.fn(),
  } as unknown as FileEventBus;
  return {
    bus,
    request,
    emitLoaded: (path: string, data: FileData) => handlers.loaded.forEach((h) => h(path, data)),
  };
}

describe('createArrayMeshProcessor', () => {
  it('decodes a requested ArrayMesh .tres and emits arraymesh:loaded with geometry', async () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createArrayMeshProcessor(file.bus, eventBus);

    const loaded = eventBus.once<ArrayMeshResource>('arraymesh', 'loaded', 'res://wall.tres', 1000);
    processor.request('res://wall.tres');
    expect(file.request).toHaveBeenCalledWith('res://wall.tres');
    file.emitLoaded('res://wall.tres', WALL_TRES);

    const resource = await loaded;
    expect(resource.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(resource.geometry.getAttribute('position').count).toBe(4);
    expect(resource.materialPaths).toEqual([null]); // wall surface has no material here
    expect(processor.getCached('res://wall.tres')).toBe(resource); // identity caching
  });

  it('ignores binary data (only decodes text .tres)', () => {
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createArrayMeshProcessor(file.bus, eventBus);

    processor.request('res://mesh.tres');
    file.emitLoaded('res://mesh.tres', new ArrayBuffer(8));
    expect(processor.getCached('res://mesh.tres')).toBeUndefined();
  });
});
