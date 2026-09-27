import { describe, expect, it } from 'vitest';
import { escapesParentSpace, spaceFamilyOf } from './parentSpace.js';

describe('spaceFamilyOf', () => {
  it.each([
    ['Node3D', 'Node3D'],
    ['MeshInstance3D', 'Node3D'],
    ['Node2D', 'CanvasItem'],
    ['Sprite2D', 'CanvasItem'],
    ['Control', 'CanvasItem'],
  ])('puts %s in the %s family', (type, family) => {
    expect(spaceFamilyOf(type)).toBe(family);
  });

  it.each([['Node'], ['Timer'], ['AnimationPlayer'], ['CanvasLayer'], ['SubViewport'], ['NavigationAgent3D']])(
    'puts %s in no family: it carries no transform or visibility of its own',
    (type) => {
      expect(spaceFamilyOf(type)).toBeNull();
    }
  );

  it('puts a class the catalog does not know in no family', () => {
    expect(spaceFamilyOf('GLBSceneRoot')).toBeNull();
  });
});

describe('escapesParentSpace, given the parent’s family', () => {
  it('keeps a Node3D under a Node3D', () => {
    expect(escapesParentSpace('Node3D', 'MeshInstance3D')).toBe(false);
  });

  it('keeps a CanvasItem under a CanvasItem', () => {
    expect(escapesParentSpace('CanvasItem', 'Label')).toBe(false);
  });

  it('frees a plain Node from a Node3D parent', () => {
    expect(escapesParentSpace('Node3D', 'Node')).toBe(true);
  });

  it('frees a CanvasItem from a Node3D parent', () => {
    expect(escapesParentSpace('Node3D', 'Sprite2D')).toBe(true);
  });

  it('frees a CanvasLayer from a CanvasItem parent', () => {
    expect(escapesParentSpace('CanvasItem', 'CanvasLayer')).toBe(true);
  });

  it('frees a Node3D from a CanvasItem parent', () => {
    expect(escapesParentSpace('CanvasItem', 'Node3D')).toBe(true);
  });

  it('frees nothing from a parent in no family, which has nothing to pass on', () => {
    expect(escapesParentSpace(null, 'MeshInstance3D')).toBe(false);
    expect(escapesParentSpace(null, 'Sprite2D')).toBe(false);
  });
});
