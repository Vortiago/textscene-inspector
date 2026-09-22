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

/** The wall quad, then a surface carrying half the `vertex_data` it declares. */
const GOOD_THEN_UNREADABLE_TRES = WALL_TRES.replace(
  '}]\nblend_shape_mode = 0',
  `}, {
"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "truncated",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")
}]
blend_shape_mode = 0`
);

/** The same pair the other way round, so the surviving surface is Godot's surface 1. */
const UNREADABLE_THEN_GOOD_TRES = WALL_TRES.replace(
  '_surfaces = [{',
  `_surfaces = [{
"aabb": AABB(-1, -1, 1, 2, 2, 0),
"format": 4097,
"index_count": 3,
"index_data": PackedByteArray("AAABAAIA"),
"name": "truncated",
"primitive": 3,
"uv_scale": Vector4(0, 0, 0, 0),
"vertex_count": 4,
"vertex_data": PackedByteArray("AACAvwAAgL8AAIA/AACAPwAAgL8AAIA/")
}, {`
);

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

  it('keeps materialPaths aligned with the draw groups when a surface is dropped', async () => {
    // materialPaths is built from the decoded surfaces while each group's
    // materialIndex comes from the builder's own loop, so the two only agree as
    // long as one list is the source of both — the decoder's.
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createArrayMeshProcessor(file.bus, eventBus);

    const loaded = eventBus.once<ArrayMeshResource>(
      'arraymesh',
      'loaded',
      'res://mixed.tres',
      1000
    );
    processor.request('res://mixed.tres');
    file.emitLoaded('res://mixed.tres', GOOD_THEN_UNREADABLE_TRES);

    const resource = await loaded;
    expect(resource.geometry.groups).toHaveLength(1);
    expect(resource.materialPaths).toHaveLength(1);
    expect(resource.geometry.groups[0]!.materialIndex).toBe(0);
    // The draw group is Godot's surface 0 — the readable one is FIRST here, so
    // the compaction has not moved it and this is the case the index agrees on.
    expect(resource.surfaceIndices).toEqual([0]);
  });

  it("carries each draw group's ORIGINAL surface index", async () => {
    // `surface_material_override/N` names the index in `_surfaces`, not the draw
    // group, so a consumer needs the two spellings kept apart once a surface
    // above has been dropped.
    const file = mockFileBus();
    const eventBus = new ResourceEventBus();
    const processor = createArrayMeshProcessor(file.bus, eventBus);

    const loaded = eventBus.once<ArrayMeshResource>(
      'arraymesh',
      'loaded',
      'res://shifted.tres',
      1000
    );
    processor.request('res://shifted.tres');
    file.emitLoaded('res://shifted.tres', UNREADABLE_THEN_GOOD_TRES);

    const resource = await loaded;
    expect(resource.materialPaths).toHaveLength(1);
    expect(resource.surfaceIndices).toEqual([1]);
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
