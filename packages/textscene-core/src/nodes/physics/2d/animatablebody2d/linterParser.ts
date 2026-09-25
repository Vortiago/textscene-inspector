/**
 * AnimatableBody2D strict validators: only the members doc/classes/AnimatableBody2D.xml lists
 * without `overrides=`. The NODE_BASE_TYPES base-walk delivers everything from StaticBody2D up,
 * and a re-declared key shadows it. The one own property is `sync_to_physics`, a plain bool with
 * no hint (scene/2d/physics/animatable_body_2d.cpp).
 */

import '../staticbody2d/linterParser.js';
import { validatorRegistry } from '../../../../linter/ValidatorRegistry.js';
import { v } from '../../../../linter/validators/index.js';

validatorRegistry.registerAll('AnimatableBody2D', {
  sync_to_physics: v.boolean('sync_to_physics'),
});
