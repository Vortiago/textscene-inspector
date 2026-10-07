import { describe, expect, it } from 'vitest';
import { isClaimedByCanvasItemEditor } from './nodeWorkspaceVisibility';

import './nodes/index';

describe('isClaimedByCanvasItemEditor', () => {
  it('claims 2D world content', () => {
    expect(isClaimedByCanvasItemEditor('Sprite2D')).toBe(true);
  });

  it('claims Control UI', () => {
    expect(isClaimedByCanvasItemEditor('Label')).toBe(true);
  });

  it('leaves 3D content to Node3DEditor', () => {
    expect(isClaimedByCanvasItemEditor('MeshInstance3D')).toBe(false);
  });

  it('leaves a SubViewport unclaimed, since it is a plain Node', () => {
    expect(isClaimedByCanvasItemEditor('SubViewport')).toBe(false);
  });
});
