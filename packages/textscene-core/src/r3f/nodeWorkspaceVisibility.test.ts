import { describe, expect, it } from 'vitest';
import { isClaimedByCanvasItemEditor, isClaimedByNode3DEditor } from './nodeWorkspaceVisibility';

import './nodes/index';

describe('isClaimedByCanvasItemEditor', () => {
  it('claims 2D world content', () => {
    expect(isClaimedByCanvasItemEditor('Sprite2D')).toBe(true);
  });

  it('claims Control UI', () => {
    expect(isClaimedByCanvasItemEditor('Label')).toBe(true);
  });

  it('claims a SubViewportContainer, since it is a Control', () => {
    expect(isClaimedByCanvasItemEditor('SubViewportContainer')).toBe(true);
  });

  it('leaves 3D content to Node3DEditor', () => {
    expect(isClaimedByCanvasItemEditor('MeshInstance3D')).toBe(false);
  });

  it('leaves a SubViewport unclaimed, since it is a plain Node', () => {
    expect(isClaimedByCanvasItemEditor('SubViewport')).toBe(false);
  });

  it('leaves an unknown type unclaimed', () => {
    expect(isClaimedByCanvasItemEditor('SomeFutureNode')).toBe(false);
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
