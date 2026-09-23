/**
 * The registry's CanvasItem classification, which the dispatcher uses to render Node3D
 * content in the 3D viewport and CanvasItems in the 2D canvas, as Godot's editor does.
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
