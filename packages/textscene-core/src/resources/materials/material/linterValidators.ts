/**
 * What Godot declares on `Material`, the abstract base under BaseMaterial3D,
 * ShaderMaterial, CanvasItemMaterial and the rest.
 */

import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('Material', {
  // material.cpp:167 hints the range from RENDER_PRIORITY_MIN/MAX, and
  // `set_render_priority` refuses both ends outright with a pair of
  // ERR_FAIL_CONDs (material.cpp:65-66), so this is the enforced tier: the
  // write never lands.
  render_priority: v.int('render_priority', {
    min: -128,
    max: 127,
    enforced: 'material.cpp:65',
  }),
  // material.cpp:168. The setter's one guard walks the chain for a cycle
  // (material.cpp:41), which a single property's literal cannot express, so the
  // reference grammar is all there is to check here.
  next_pass: v.resourceReference('next_pass'),
});
