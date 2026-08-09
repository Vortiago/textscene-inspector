/**
 * The `restart` branch of `CPUParticles2D::_particles_process`: a fresh draw
 * from the per-particle RNG, plus the emission-shape offset it ends on.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import { sampleCurve } from '../../../resources/curves/curve/sample';
import { sampleGradientColor } from '../../../resources/textures/gradienttexture2d/sample';
import { IDENTITY_AFFINE } from './affine2d';
import type { GodotRandomPCG } from './godotRng';
import { degToRad, lerp } from './particleMath';
import type { Particle, ParticleSimInput, SimState } from './simTypes';
import {
  CPUParticles2DEmissionShape,
  CPUParticles2DParam,
  type CPUParticles2DProperties,
} from './types';

/** The `restart` branch: a fresh draw from the per-particle RNG. */
export function restartParticle(
  state: SimState,
  input: ParticleSimInput,
  p: Particle,
  index: number,
  tv: number
): void {
  const { props, curves, colorInitialRamp } = input;

  const angleCurve = curves[CPUParticles2DParam.Angle] ?? null;
  const texAngle = angleCurve ? sampleCurve(angleCurve, tv) : 1.0;
  // Godot samples the ANGLE curve here for the anim offset too — its own
  // copy-paste (`cpu_particles_2d.cpp:916-919`), reproduced so a scene that
  // sets an angle curve gets the same anim offset it does in the engine. Same
  // curve, same `tv`, so it is the same value rather than a second search.
  const texAnimOffset = texAngle;

  p.active = true;
  p.seed = (state.seed + index + index + state.cycle) >>> 0;
  const rng = state.rng;
  rng.seed(p.seed);

  p.angleRand = rng.randf();
  p.scaleRand = rng.randf();
  p.hueRotRand = rng.randf();
  p.animOffsetRand = rng.randf();

  p.startColorRand = colorInitialRamp
    ? sampleGradientColor(colorInitialRamp, rng.randf())
    : { r: 1, g: 1, b: 1, a: 1 };

  const angle1Rad =
    Math.atan2(props.direction.y, props.direction.x) +
    degToRad((rng.randf() * 2.0 - 1.0) * props.spread);
  const speed = lerp(
    props.params[CPUParticles2DParam.InitialLinearVelocity]!.min,
    props.params[CPUParticles2DParam.InitialLinearVelocity]!.max,
    rng.randf()
  );
  p.velocity = { x: Math.cos(angle1Rad) * speed, y: Math.sin(angle1Rad) * speed };

  const angleParam = props.params[CPUParticles2DParam.Angle]!;
  p.rotation = degToRad(texAngle * lerp(angleParam.min, angleParam.max, p.angleRand));

  const animOffset = props.params[CPUParticles2DParam.AnimOffset]!;
  p.custom[0] = 0.0;
  p.custom[1] = 0.0;
  p.custom[2] = texAnimOffset * lerp(animOffset.min, animOffset.max, p.animOffsetRand);
  p.custom[3] = 1.0 - rng.randf() * props.lifetime_randomness;
  p.transform = { ...IDENTITY_AFFINE };
  p.time = 0;
  p.lifetime = state.lifetime * p.custom[3];
  p.baseColor = { r: 1, g: 1, b: 1, a: 1 };

  emitAtShape(props, p, rng);
}

/**
 * The emission-shape offset. POINTS / DIRECTED_POINTS / RING are absent on
 * purpose: those three draw from Godot's unserialised GLOBAL RNG
 * (`cpu_particles_2d.cpp:936, 953, 956`), not the per-particle one, so no
 * frozen pose can match the engine. The linter warns instead.
 */
function emitAtShape(props: CPUParticles2DProperties, p: Particle, rng: GodotRandomPCG): void {
  switch (props.emission_shape) {
    case CPUParticles2DEmissionShape.Sphere: {
      const t = 2 * Math.PI * rng.randf();
      const radius = props.emission_sphere_radius * rng.randf();
      p.transform.ox = Math.cos(t) * radius;
      p.transform.oy = Math.sin(t) * radius;
      break;
    }
    case CPUParticles2DEmissionShape.SphereSurface: {
      const s = rng.randf();
      const t = 2 * Math.PI * rng.randf();
      const radius = props.emission_sphere_radius * Math.sqrt(1.0 - s * s);
      p.transform.ox = Math.cos(t) * radius;
      p.transform.oy = Math.sin(t) * radius;
      break;
    }
    case CPUParticles2DEmissionShape.Rectangle: {
      // Godot writes this as ONE `Vector2(rng->randf() …, rng->randf() …)`
      // constructor call, and C++ leaves argument evaluation order
      // unspecified — the shipped builds draw Y FIRST. Measured, not derived:
      // rendering this emitter through Godot 4.6.3 puts particle 0 at
      // (+44.5, +9.3) from the node, which is the y-first draw; the x-first
      // reading lands at (+25.4, +16.9) and matches nothing on screen.
      const y = rng.randf();
      const x = rng.randf();
      p.transform.ox = (x * 2.0 - 1.0) * props.emission_rect_extents.x;
      p.transform.oy = (y * 2.0 - 1.0) * props.emission_rect_extents.y;
      break;
    }
    default:
      // Point, and the three unpreviewable shapes, all leave the origin alone.
      break;
  }
}
