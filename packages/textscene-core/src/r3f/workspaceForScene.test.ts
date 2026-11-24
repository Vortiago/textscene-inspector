/**
 * Which Godot editor workspace a scene root claims (ADR-0006 amendment):
 * CanvasItemEditor claims any CanvasItem, Node3DEditor claims Node3D, and a
 * plain `Node` root is claimed by neither, so the editor stays where it was.
 */
import { describe, expect, it } from 'vitest';
import { workspaceForRootType } from './workspaceForScene';

import './nodes/index';

describe('workspaceForRootType', () => {
  it('claims 3D for a Node3D root', () => {
    expect(workspaceForRootType('Node3D')).toBe('3D');
    expect(workspaceForRootType('MeshInstance3D')).toBe('3D');
  });

  it('claims 2D for a CanvasItem or Control root', () => {
    expect(workspaceForRootType('Node2D')).toBe('2D');
    expect(workspaceForRootType('Control')).toBe('2D');
    expect(workspaceForRootType('CanvasLayer')).toBe('2D');
  });

  it('claims neither for a plain Node root, so the current workspace holds', () => {
    expect(workspaceForRootType('Node')).toBeNull();
  });

  it('claims neither for an unknown type', () => {
    expect(workspaceForRootType('SomeFutureNode')).toBeNull();
  });

  it('claims neither for a SubViewport root, since no Godot editor plugin handles a Viewport', () => {
    // It is a `Node`, not a spatial or canvas node, though it is registered and
    // no container.
    expect(workspaceForRootType('SubViewport')).toBeNull();
  });

  it('returns null for no root', () => {
    expect(workspaceForRootType(null)).toBeNull();
  });
});
