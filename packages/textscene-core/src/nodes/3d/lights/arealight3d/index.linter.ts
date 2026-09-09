/**
 * AreaLight3D linter registration - imports linter components to trigger self-registration.
 *
 * Validators only: the one semantic rule this slice had was a `light_energy`
 * range advisory, and that floor is now the Light3D validator's bound
 * (light_3d.cpp:389), which AreaLight3D inherits through the base-walk.
 */

import './linterParser.js';
