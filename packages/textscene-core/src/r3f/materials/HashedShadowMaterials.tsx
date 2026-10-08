/**
 * The depth materials of an ALPHA_HASH surface's shadow, which Godot's shadow shader hashes as its
 * colour pass does. three's shared depth material copies `alphaTest` and `map` from the surface,
 * but not `alphaHash` (`WebGLShadowMap.js:493-494`), so the surface mounts its own, which three
 * gives the same `map`.
 */

import { materialProgramInputs } from '../materialProgramInputs';

export function HashedShadowMaterials() {
  const depth = materialProgramInputs({ props: { attach: 'customDepthMaterial', alphaHash: true } });
  const distance = materialProgramInputs({ props: { attach: 'customDistanceMaterial', alphaHash: true } });
  return (
    <>
      <meshDepthMaterial key={depth.key} {...depth.props} />
      <meshDistanceMaterial key={distance.key} {...distance.props} />
    </>
  );
}
