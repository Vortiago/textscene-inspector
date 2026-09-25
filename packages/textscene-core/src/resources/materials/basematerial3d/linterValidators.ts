/**
 * Format and bound validation for the properties Godot declares on `BaseMaterial3D`,
 * one module per property group. A validator-only directory, as the class is abstract.
 * A cross-property check needs the linter to walk SubResources, which it does not do.
 */

// Registers Material, so the inherited keys resolve when this module loads alone.
import '../material/linterValidators.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { featureKeys } from './features.js';
import { pbrKeys } from './pbr.js';
import { renderKeys } from './render.js';
import { stencilKeys } from './stencil.js';
import { surfaceKeys } from './surface.js';
import { uvKeys } from './uv.js';

// On the declaring class, not the leaf a scene names, so the walk (classBaseTypes.ts)
// delivers them to `StandardMaterial3D` and `ORMMaterial3D` alike.
validatorRegistry.registerAll(
  'BaseMaterial3D',
  surfaceKeys,
  pbrKeys,
  featureKeys,
  uvKeys,
  renderKeys,
  stencilKeys
);
