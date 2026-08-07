/**
 * xrcamera3d linter registration - imports the linter component to trigger
 * self-registration.
 *
 * No linterParser.ts: XRCamera3D declares no ADD_PROPERTY of its own, so there
 * is nothing to format-validate; the parent-type rule in linter.ts is the
 * whole slice's lint surface.
 */

import './linter.js';
