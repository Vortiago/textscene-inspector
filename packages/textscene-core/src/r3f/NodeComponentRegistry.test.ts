/**
 * The registry's CanvasItem classification, which the dispatcher uses to render Node3D
 * content in the 3D viewport and CanvasItems in the 2D canvas, as Godot's editor does.
 */
import { describe, it, expect } from 'vitest';
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { invisibleBase } from './invisibleBase';

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

describe('nodeComponentRegistry.register against the declared intent', () => {
  // A base mounts the transform and draws nothing, as Node3D, Node2D and Node do.
  const Base = invisibleBase(() => null);
  const Drawer = () => null;

  it('accepts a pending gap on a base, and a drawing component under the default intent', () => {
    nodeComponentRegistry.register({ typeName: '__TestGap', Component: Base, renderIntent: 'pending' });
    nodeComponentRegistry.register({ typeName: '__TestDrawn', Component: Drawer });
    expect(nodeComponentRegistry.renderIntentOf('__TestGap')).toBe('pending');
    expect(nodeComponentRegistry.renderIntentOf('__TestDrawn')).toBe('draws');
  });

  it('refuses a drawing component under `pending`, which the badge would show as not drawn', () => {
    expect(() =>
      nodeComponentRegistry.register({
        typeName: '__TestDrawnGap',
        Component: Drawer,
        renderIntent: 'pending',
      })
    ).toThrow(/__TestDrawnGap.*pending.*draws/);
  });

  it('refuses a base under the default intent, which the badge would show as drawn', () => {
    expect(() => nodeComponentRegistry.register({ typeName: '__TestUndrawn', Component: Base })).toThrow(
      /__TestUndrawn.*draws.*base/
    );
  });

  it("accepts a 2D-UI type's 3D pass-through on a base, since its Control component draws it", () => {
    nodeComponentRegistry.register({ typeName: 'SubViewportContainer', Component: Base, container: true });
    expect(nodeComponentRegistry.renderIntentOf('SubViewportContainer')).toBe('draws');
  });
});
