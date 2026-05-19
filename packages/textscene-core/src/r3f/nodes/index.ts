/**
 * Barrel that imports every node-type folder for its self-registration
 * side effect. Importing this module is sufficient to populate
 * nodeComponentRegistry with the full MVS set of R3F node components.
 *
 * GenericNodeFallback is intentionally NOT registered — the recursive
 * dispatcher renders it explicitly when registry.get(typeName) returns
 * undefined.
 */

import './node';
import './node3d';
import './meshinstance3d';
import './camera3d';
import './lights/directionallight3d';
import './lights/omnilight3d';
import './lights/spotlight3d';
import './worldenvironment';
import './label3d';

export { GenericNodeFallback } from './generic-node-fallback';
