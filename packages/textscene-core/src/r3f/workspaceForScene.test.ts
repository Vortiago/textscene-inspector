/**
 * Which Godot editor workspace a scene root claims (ADR-0006 amendment):
 * CanvasItemEditor claims any CanvasItem, Node3DEditor claims Node3D, and a
 * plain `Node` root is claimed by neither, so the editor stays where it was.
 */
import { describe, expect, it } from 'vitest';
import { workspaceForRoot } from './workspaceForScene';
import type { TscnNode } from '../parser/types';

import './nodes/index';

const root = (type: string): TscnNode => ({
  rawProperties: {},
  name: 'Root',
  type,
  children: [],
  properties: { name: 'Root' },
});

describe('workspaceForRoot', () => {
  it('claims 3D for a Node3D root', () => {
    expect(workspaceForRoot(root('Node3D'))).toBe('3D');
    expect(workspaceForRoot(root('MeshInstance3D'))).toBe('3D');
  });

  it('claims 2D for a CanvasItem or Control root', () => {
    expect(workspaceForRoot(root('Node2D'))).toBe('2D');
    expect(workspaceForRoot(root('Control'))).toBe('2D');
    expect(workspaceForRoot(root('CanvasLayer'))).toBe('2D');
  });

  it('claims neither for a plain Node root, so the current workspace holds', () => {
    expect(workspaceForRoot(root('Node'))).toBeNull();
  });

  it('claims neither for an unknown type', () => {
    expect(workspaceForRoot(root('SomeFutureNode'))).toBeNull();
  });

  it('claims neither for a SubViewport root, since no Godot editor plugin handles a Viewport', () => {
    // It is a `Node`, not a spatial or canvas node, though it is registered and
    // no container.
    expect(workspaceForRoot(root('SubViewport'))).toBeNull();
  });

  it('returns null for an absent root', () => {
    expect(workspaceForRoot(undefined)).toBeNull();
  });
});
