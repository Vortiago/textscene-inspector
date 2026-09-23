/**
 * Every registered 2D-canvas node type carries the `canvasItem` flag, or the
 * workspace-aware dispatcher puts it in the wrong workspace.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: register every slice's render component
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { descendsFrom } from '../godot/nodeBaseTypes.js';

describe('canvasItem registry conformance', () => {
  it('flags every registered CanvasItem descendant as canvasItem', () => {
    // By the base chain, not the `2D` suffix: `NavigationAgent2D` and
    // `NavigationObstacle2D` descend from `Node`, draw nothing, and stay out of
    // the 2D canvas.
    const canvasItems = nodeComponentRegistry
      .getAllTypeNames()
      .filter((t) => descendsFrom(t, 'CanvasItem'));
    // If `descendsFrom` returned false for everything, the check would pass
    // vacuously.
    expect(canvasItems.length).toBeGreaterThan(10);
    expect(canvasItems.filter((t) => !nodeComponentRegistry.isCanvasItem(t))).toEqual([]);
  });

  it('never flags 3D content as canvasItem', () => {
    // The base chain, as above: Decal, FogVolume, GridMap, VoxelGI,
    // ReflectionProbe, LightmapGI and the OpenXR nodes are Node3D descendants
    // without the suffix.
    const node3ds = nodeComponentRegistry
      .getAllTypeNames()
      .filter((t) => descendsFrom(t, 'Node3D'));
    expect(node3ds.length).toBeGreaterThan(10);
    expect(node3ds.filter((t) => nodeComponentRegistry.isCanvasItem(t))).toEqual([]);
  });
});
