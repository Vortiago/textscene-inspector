/**
 * The two walks must agree on which types own a canvas.
 *
 * `_enter_canvas` climbs until `Object::cast_to<CanvasLayer>(n)` succeeds
 * (`scene/main/canvas_item.cpp:246-252`), so every `CanvasLayer` subclass is
 * where a broken chain lands. The Node2D world walk asks that with
 * `isCanvasLayerType`, derived from ClassDB; the Control walk asks it with
 * `controlSolverRegistry.isCanvasBoundary`, a per-slice registration. One
 * question, two mechanisms — and `ParallaxBackground` sat in the first and not
 * the second, so a Control inside one hoisted straight past its layer onto the
 * viewport's canvas.
 *
 * A registration cannot be derived: the boundary also needs a painter and a
 * full-viewport rect, which only the slice can supply. So this asserts the
 * coverage instead, over the whole pinned catalog rather than over the two
 * names anybody happens to remember.
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
