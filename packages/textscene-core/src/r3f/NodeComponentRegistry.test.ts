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

describe('nodeComponentRegistry.register', () => {
  function Dummy() {
    return null;
  }

  it("mounts a GeometryInstance3D type's component in its place in the scene cull", () => {
    nodeComponentRegistry.register({ typeName: 'Label3D', Component: Dummy });
    expect(nodeComponentRegistry.get('Label3D')?.displayName).toBe('withGeometryInstance(Dummy)');
  });

  it('keeps the component of a type outside GeometryInstance3D', () => {
    nodeComponentRegistry.register({ typeName: 'MeshLibrary', Component: Dummy });
    expect(nodeComponentRegistry.get('MeshLibrary')).toBe(Dummy);
  });

  it('keeps the component of a type ClassDB does not know (edge case)', () => {
    nodeComponentRegistry.register({ typeName: '__TestUnknown', Component: Dummy });
    expect(nodeComponentRegistry.get('__TestUnknown')).toBe(Dummy);
  });
});
