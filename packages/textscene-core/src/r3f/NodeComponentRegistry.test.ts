/**
 * The registry's CanvasItem classification, which the dispatcher uses to render Node3D
 * content in the 3D viewport and CanvasItems in the 2D canvas, as Godot's editor does.
 */
import { describe, it, expect } from 'vitest';
import { nodeComponentRegistry } from './NodeComponentRegistry';

const Dummy = () => null;

describe('nodeComponentRegistry.isCanvasItem', () => {
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

describe('nodeComponentRegistry.passesThrough', () => {
  it('passes a container through', () => {
    nodeComponentRegistry.register({ typeName: '__TestContainer', Component: Dummy, container: true });
    expect(nodeComponentRegistry.passesThrough('__TestContainer')).toBe(true);
  });

  it('passes an unregistered type through', () => {
    expect(nodeComponentRegistry.passesThrough('__NeverRegistered')).toBe(true);
  });

  it('holds back a registered type that is no container', () => {
    nodeComponentRegistry.register({ typeName: '__TestLeaf', Component: Dummy });
    expect(nodeComponentRegistry.passesThrough('__TestLeaf')).toBe(false);
  });
});
