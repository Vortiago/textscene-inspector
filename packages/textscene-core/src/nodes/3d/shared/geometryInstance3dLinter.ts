/**
 * The `GeometryInstance3D` validators its subclasses share.
 *
 * The linter's base walk (`linter/nodeBaseTypes.ts`) models only the levels that
 * carry validators, and it maps every 3D leaf straight to `Node3D` — so there is
 * no GeometryInstance3D level for a subclass to inherit `cast_shadow` from, and
 * each one that wants it must register it. This module is what they register, so
 * `GeometryInstance3D::ShadowCastingSetting` (`scene/3d/visual_instance_3d.h`) is
 * transcribed once rather than once per subclass.
 */

import { v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';

const CAST_SHADOW = { 0: 'OFF', 1: 'ON', 2: 'DOUBLE_SIDED', 3: 'SHADOWS_ONLY' };

export const geometryInstance3dValidators: Record<string, PropertyValidator> = {
  cast_shadow: v.enumInt('cast_shadow', 0, 3, CAST_SHADOW),
};
