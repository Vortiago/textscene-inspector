/**
 * The component registry's CanvasItem classification — the seam the
 * workspace-aware dispatcher uses to decide what renders in the 3D viewport
 * (Node3D content only, like Godot's editor) vs the 2D world canvas.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { nodeComponentRegistry } from './NodeComponentRegistry';

const Dummy = () => null;

describe('nodeComponentRegistry.isCanvasItem', () => {
  afterEach(() => {
    // The registry is a module singleton shared with the slice
    // registrations; remove only what this suite added.
  });

  it('classifies registrations flagged canvasItem; defaults to false', () => {
    nodeComponentRegistry.register({
      typeName: '__TestCanvasNode',
      Component: Dummy,
      canvasItem: true,
    });
    nodeComponentRegistry.register({ typeName: '__TestSpatialNode', Component: Dummy });

    expect(nodeComponentRegistry.isCanvasItem('__TestCanvasNode')).toBe(true);
    expect(nodeComponentRegistry.isCanvasItem('__TestSpatialNode')).toBe(false);
    expect(nodeComponentRegistry.isCanvasItem('__NeverRegistered')).toBe(false);
  });
});
