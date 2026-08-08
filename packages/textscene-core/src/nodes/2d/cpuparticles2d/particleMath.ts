/**
 * The two scalar helpers every step of the particle port reaches for.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

export function lerp(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

export function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
