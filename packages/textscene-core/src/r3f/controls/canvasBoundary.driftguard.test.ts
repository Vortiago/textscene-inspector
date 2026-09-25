/**
 * The two walks agree on which types own a canvas: `_enter_canvas` stops at any
 * `CanvasLayer` subclass (`scene/main/canvas_item.cpp:246-252`). The Node2D walk
 * derives it from ClassDB, the Control walk registers it per slice, since only a
 * slice supplies the painter and rect, so this checks the whole pinned catalog.
 */
import { describe, expect, it } from 'vitest';
import { CATALOG_BASE_TYPES } from '../../godot/nodeBaseTypes.generated';
import { descendsFrom } from '../../godot/nodeBaseTypes';
import { isCanvasLayerType } from '../canvasPaintOrder';
import { controlSolverRegistry } from './native/solverRegistry';
import { TWO_D_UI_TYPES } from './has2DUIContent';

import '../nodes/index';
import './index';

/** Every catalogued type Godot's own `cast_to<CanvasLayer>` would accept. */
const CANVAS_LAYER_TYPES = Object.keys(CATALOG_BASE_TYPES).filter((type) =>
  descendsFrom(type, 'CanvasLayer')
);

describe('canvas-layer coverage', () => {
  it('finds the catalogued CanvasLayer subclasses', () => {
    expect(CANVAS_LAYER_TYPES).toContain('CanvasLayer');
    expect(CANVAS_LAYER_TYPES).toContain('ParallaxBackground');
  });

  it('answers the world walk’s question for every one of them', () => {
    expect(CANVAS_LAYER_TYPES.filter((type) => !isCanvasLayerType(type))).toEqual([]);
  });

  it('registers every one of them as a Control-walk canvas boundary', () => {
    expect(
      CANVAS_LAYER_TYPES.filter((type) => !controlSolverRegistry.isCanvasBoundary(type))
    ).toEqual([]);
  });

  it('walks every one of them in the Control tree at all', () => {
    // A boundary with no `SolveNode` adopts nothing: `buildSolveTree` only
    // builds one for a type in this set.
    expect(CANVAS_LAYER_TYPES.filter((type) => !TWO_D_UI_TYPES.has(type))).toEqual([]);
  });
});
