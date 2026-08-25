/**
 * CanvasLayer strict validators for linting.
 *
 * CanvasLayer is not a Control (no anchors/offsets) and not a CanvasItem
 * either — it extends Node directly (canvas_layer.h:36) — so the base chain
 * pulled in is Node's own linterParser, not Control's.
 */

// The terminal tier. Registration is self-registering on import, so a slice
// test that loads only this chain must pull `Node` explicitly or its keys
// resolve to null in isolation and only the full barrel sees them.
import '../../../node/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';
import { CANVAS_LAYER_MIN, CANVAS_LAYER_MAX } from '../../../../godot/rendering.js';

validatorRegistry.registerAll('CanvasLayer', {
  // canvas_layer.cpp:340 — PROPERTY_HINT_RANGE bound exactly to int32 min/max
  // (RS::CANVAS_LAYER_MIN/MAX, rendering_server.h:105-106). set_layer
  // (canvas_layer.cpp:37-43) is a bare assignment with no clamp or
  // ERR_FAIL, so a value outside int32 is a warning, not an error.
  layer: v.int('layer', {
    min: CANVAS_LAYER_MIN,
    max: CANVAS_LAYER_MAX,
    hinted: 'canvas_layer.cpp:340',
  }),
  // canvas_layer.cpp:49-65 — set_visible is a bare assignment (plus an
  // early-return no-op check), no hint on the BOOL property.
  visible: v.boolean('visible'),
  // canvas_layer.cpp:118-125 — set_offset is a bare assignment. Hint is
  // PROPERTY_HINT_NONE with "suffix:px" only (canvas_layer.cpp:343), not a
  // bound.
  offset: v.vector2('offset'),
  // canvas_layer.cpp:344 — PROPERTY_HINT_RANGE "-1080,1080,0.1,or_less,
  // or_greater,radians_as_degrees": both ends carry their open flag, so
  // neither ever warns. set_rotation (canvas_layer.cpp:135-142) is a bare
  // assignment too. Left unbounded rather than reached for `v.radians`,
  // which would manufacture a bound neither the hint nor the setter has.
  rotation: v.float('rotation'),
  // canvas_layer.cpp:152-159 — set_scale is a bare assignment, no zero
  // guard (unlike Node2D's, which substitutes CMP_EPSILON). Hint is
  // PROPERTY_HINT_LINK (canvas_layer.cpp:345), an inspector display hint,
  // not a bound.
  scale: v.vector2('scale'),
  // canvas_layer.cpp:79-85 — set_transform is a bare assignment. Hint is
  // PROPERTY_HINT_NONE with "suffix:px" only (canvas_layer.cpp:346).
  transform: v.transform2d('transform'),
  // canvas_layer.cpp:273-280 — set_follow_viewport is a bare assignment
  // (plus an equal-check). Hint is PROPERTY_HINT_GROUP_ENABLE
  // (canvas_layer.cpp:350), which only makes the group checkable in the
  // inspector and carries no bound for a BOOL.
  follow_viewport_enabled: v.boolean('follow_viewport_enabled'),
  // canvas_layer.cpp:351 — PROPERTY_HINT_RANGE "0.001,1000,0.001,
  // or_greater,or_less": both ends open, same shape as `rotation`, so no
  // bound applies. set_follow_viewport_scale (canvas_layer.cpp:286-289) is
  // a bare assignment.
  follow_viewport_scale: v.float('follow_viewport_scale'),
});
