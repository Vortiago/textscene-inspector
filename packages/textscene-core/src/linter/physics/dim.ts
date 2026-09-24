/** Shared 2D/3D dimension token for the physics linter-rule factories. */

export type PhysicsDim = '2D' | '3D';

/** Lowercase suffix used in rule names, for example `area2d` and `rigidbody3d`. */
export function dimSuffix(dim: PhysicsDim): string {
  return dim.toLowerCase();
}
