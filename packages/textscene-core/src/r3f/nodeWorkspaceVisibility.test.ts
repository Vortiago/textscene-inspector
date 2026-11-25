import { describe, expect, it } from 'vitest';
import { drawsInWorkspace, isClaimedByNode3DEditor } from './nodeWorkspaceVisibility';

import './nodes/index';

describe('drawsInWorkspace of the 3D canvas', () => {
  it('leaves 2D world content to the 2D canvas', () => {
    expect(drawsInWorkspace('Sprite2D', '3d')).toBe(false);
  });

  it('leaves Control UI to the 2D canvas', () => {
    expect(drawsInWorkspace('Label', '3d')).toBe(false);
  });

  it('draws a SubViewportContainer, whose sub-viewport 3D content Godot draws in its 3D view', () => {
    expect(drawsInWorkspace('SubViewportContainer', '3d')).toBe(true);
  });

  it('draws 3D content', () => {
    expect(drawsInWorkspace('MeshInstance3D', '3d')).toBe(true);
  });
});

describe('isClaimedByNode3DEditor', () => {
  it('claims registered 3D content', () => {
    expect(isClaimedByNode3DEditor('MeshInstance3D')).toBe(true);
  });

  it('leaves 2D content to CanvasItemEditor', () => {
    expect(isClaimedByNode3DEditor('Sprite2D')).toBe(false);
  });

  it('leaves a plain Node unclaimed', () => {
    expect(isClaimedByNode3DEditor('Node')).toBe(false);
  });

  it('leaves a SubViewport unclaimed, though it is registered', () => {
    expect(isClaimedByNode3DEditor('SubViewport')).toBe(false);
  });

  it('leaves an unknown type unclaimed', () => {
    expect(isClaimedByNode3DEditor('SomeFutureNode')).toBe(false);
  });
});
