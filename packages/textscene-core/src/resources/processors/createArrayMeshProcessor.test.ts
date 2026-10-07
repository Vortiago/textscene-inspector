/**
 * ArrayMesh processor: decodes the section a path addresses in the owning file's
 * parse and emits a THREE.BufferGeometry on the 'arraymesh' bus slot.
 */
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { parseTresFile } from '../../parser/parsedResource';
import { ResourceEventBus } from '../ResourceEventBus';
import { sectionLoader } from '../resourceSection';
import { createArrayMeshProcessor, type ArrayMeshResource } from './createArrayMeshProcessor';
import { truncatedSurface, wallQuadSurfaces } from '../testing/arrayMeshSurfaces';

const WALL_TRES = `[gd_resource type="ArrayMesh" format=4 uid="uid://bett1yahcwe25"]

[resource]
_surfaces = ${wallQuadSurfaces({})}
blend_shape_mode = 0
`;

/** The wall quad, then a surface carrying half the `vertex_data` it declares. */
const GOOD_THEN_UNREADABLE_TRES = WALL_TRES.replace(
  '}]\nblend_shape_mode = 0',
  `}, ${truncatedSurface({ name: 'truncated' })}]
blend_shape_mode = 0`
);

/** The same pair the other way round, so the surviving surface is Godot's surface 1. */
const UNREADABLE_THEN_GOOD_TRES = WALL_TRES.replace(
  '_surfaces = [{',
  `_surfaces = [${truncatedSurface({ name: 'truncated' })}, {`
);

/** A processor whose section loader parses `tres` for every path. */
function processorServing(tres: string) {
  const eventBus = new ResourceEventBus();
  const processor = createArrayMeshProcessor(
    eventBus,
    sectionLoader(async () => parseTresFile(tres))
  );
  return { eventBus, processor };
}

describe('createArrayMeshProcessor', () => {
  it('decodes a requested ArrayMesh .tres and emits arraymesh:loaded with geometry', async () => {
    const { eventBus, processor } = processorServing(WALL_TRES);

    const loaded = eventBus.once<ArrayMeshResource>('arraymesh', 'loaded', 'res://wall.tres', 1000);
    processor.request('res://wall.tres');

    const resource = await loaded;
    expect(resource.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(resource.geometry.getAttribute('position').count).toBe(4);
    expect(resource.materialPaths).toEqual([null]); // wall surface has no material here
    expect(processor.getCached('res://wall.tres')).toBe(resource); // identity caching
  });

  it('keeps materialPaths aligned with the draw groups when a surface is dropped', async () => {
    // materialPaths comes from the decoded surfaces and each group's
    // materialIndex from the builder's loop, so they agree only while the
    // decoder's list is the source of both.
    const { eventBus, processor } = processorServing(GOOD_THEN_UNREADABLE_TRES);

    const loaded = eventBus.once<ArrayMeshResource>('arraymesh', 'loaded', 'res://mixed.tres', 1000);
    processor.request('res://mixed.tres');

    const resource = await loaded;
    expect(resource.geometry.groups).toHaveLength(1);
    expect(resource.materialPaths).toHaveLength(1);
    expect(resource.geometry.groups[0]!.materialIndex).toBe(0);
    // The draw group is Godot's surface 0: the readable surface comes first, so
    // the compaction has not moved it and the indices agree.
    expect(resource.surfaceIndices).toEqual([0]);
  });

  it("carries each draw group's ORIGINAL surface index", async () => {
    // `surface_material_override/N` names the index in `_surfaces`, not the draw
    // group, so a consumer keeps the two apart when a surface above is dropped.
    const { eventBus, processor } = processorServing(UNREADABLE_THEN_GOOD_TRES);

    const loaded = eventBus.once<ArrayMeshResource>('arraymesh', 'loaded', 'res://shifted.tres', 1000);
    processor.request('res://shifted.tres');

    const resource = await loaded;
    expect(resource.materialPaths).toHaveLength(1);
    expect(resource.surfaceIndices).toEqual([1]);
  });

  it('emits arraymesh:failed and caches null for an address that is not an ArrayMesh', async () => {
    const { eventBus, processor } = processorServing('[gd_resource type="BoxMesh" format=3]\n\n[resource]\n');

    const failed = eventBus.once<Error>('arraymesh', 'failed', 'res://box.tres', 1000);
    processor.request('res://box.tres');

    expect((await failed).message).toBe('res://box.tres has type BoxMesh, expected ArrayMesh');
    expect(processor.getCached('res://box.tres')).toBeNull();
  });
});
