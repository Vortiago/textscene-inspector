/**
 * Conformance guard: every registered 2D-canvas node type must carry the
 * `canvasItem` flag — the workspace-aware dispatcher (Godot-editor split:
 * 3D viewport renders Node3D only, the 2D canvas renders CanvasItems only)
 * silently misplaces any unflagged 2D slice.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: register every slice's render component
import { nodeComponentRegistry } from './NodeComponentRegistry';

describe('canvasItem registry conformance', () => {
  it('flags every 2D-suffixed and tile node type as canvasItem', () => {
    const missing = nodeComponentRegistry
      .getAllTypeNames()
      .filter((t) => t.endsWith('2D') || t === 'TileMap' || t === 'TileMapLayer')
      .filter((t) => !nodeComponentRegistry.isCanvasItem(t));
    expect(missing).toEqual([]);
  });

  it('never flags 3D content as canvasItem', () => {
    const wrong = nodeComponentRegistry
      .getAllTypeNames()
      .filter((t) => t.endsWith('3D'))
      .filter((t) => nodeComponentRegistry.isCanvasItem(t));
    expect(wrong).toEqual([]);
  });
});
