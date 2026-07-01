/** Shared 2D/3D dimension token for the physics linter-rule factories. */

export type PhysicsDim = '2D' | '3D';

/** Lowercase suffix used in rule names, e.g. `area2d`, `rigidbody3d`. */
export function dimSuffix(dim: PhysicsDim): string {
  return dim.toLowerCase();
}
