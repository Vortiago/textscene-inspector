/**
 * Conformance guard: every registered 2D-canvas node type must carry the
 * `canvasItem` flag — the workspace-aware dispatcher (Godot-editor split:
 * 3D viewport renders Node3D only, the 2D canvas renders CanvasItems only)
 * silently misplaces any unflagged 2D slice.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: register every slice's render component
import { nodeComponentRegistry } from './NodeComponentRegistry';
import { descendsFrom } from '../linter/nodeBaseTypes.js';

describe('canvasItem registry conformance', () => {
  it('flags every registered CanvasItem descendant as canvasItem', () => {
    // The `2D` SUFFIX is a naming convention, not a base class. Godot has types
    // that carry it and descend from plain `Node`: `NavigationAgent2D` and
    // `NavigationObstacle2D` are agents attached to a parent, not canvas items,
    // and flagging them would place them in the 2D canvas the dispatcher
    // reserves for things that draw. Ask the derived base chain rather than the
    // name, so a future such type needs no allowlist entry.
    const canvasItems = nodeComponentRegistry
      .getAllTypeNames()
      .filter((t) => descendsFrom(t, 'CanvasItem'));
    // If `descendsFrom` ever returned false for everything, the sweep would
    // pass vacuously while flagging nothing.
    expect(canvasItems.length).toBeGreaterThan(10);
    expect(canvasItems.filter((t) => !nodeComponentRegistry.isCanvasItem(t))).toEqual([]);
  });

  it('never flags 3D content as canvasItem', () => {
    const wrong = nodeComponentRegistry
      .getAllTypeNames()
      .filter((t) => t.endsWith('3D'))
      .filter((t) => nodeComponentRegistry.isCanvasItem(t));
    expect(wrong).toEqual([]);
  });
});
