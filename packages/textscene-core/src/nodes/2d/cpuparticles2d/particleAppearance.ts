/**
 * The appearance pass every particle takes, restarted or not: scale, colour,
 * hue rotation and the quad's basis.
 *
 * Part of the CPUParticles2D port; the derivation notice is in `simulate.ts`.
 */

import type { Color, Vector2 } from '../../base/node2d/types';
import { sampleCurve } from '../../../resources/curves/curve/sample';
import { sampleGradientColor } from '../../../resources/textures/gradienttexture2d/sample';
import { lerp } from '../../../godot/math.js';
import type { Particle, ParticleSimInput } from './simTypes';
import { CPUParticles2DParam } from './types';

/** Scale, colour, hue rotation and the quad's basis — run for every particle. */
export function applyAppearance(input: ParticleSimInput, p: Particle, tv: number): void {
  const { props, curves, colorRamp } = input;

  const scaleCurve = curves[CPUParticles2DParam.Scale] ?? null;
  const texScale = scaleCurve ? sampleCurve(scaleCurve, tv) : 1.0;

  const hueCurve = curves[CPUParticles2DParam.HueVariation] ?? null;
  // Unlike every other slot this one defaults to 0, not 1: with no curve there
  // is no hue rotation at all.
  const texHueVariation = hueCurve ? sampleCurve(hueCurve, tv) : 0.0;

  const hueParam = props.params[CPUParticles2DParam.HueVariation]!;
  const hueRotAngle =
    texHueVariation * 2 * Math.PI * lerp(hueParam.min, hueParam.max, p.hueRotRand);

  const base = colorRamp
    ? multiplyColor(sampleGradientColor(colorRamp, tv), props.color)
    : { ...props.color };
  // Called unconditionally, and NOT short-circuited at angle 0: Godot's basis is
  // not quite the identity there. The blue column comes out at -0.001/-0.001/1,
  // so every particle in every scene takes a slight tint, and skipping the call
  // would silently diverge from the engine on the most common path of all.
  const rotated = rotateHue(base, hueRotAngle);

  p.color = multiplyColor(multiplyColor(rotated, p.baseColor), p.startColorRand);

  if (props.particle_flag_align_y) {
    let yAxis: Vector2 =
      Math.hypot(p.velocity.x, p.velocity.y) > 0
        ? { x: p.velocity.x, y: p.velocity.y }
        : { x: p.transform.bx, y: p.transform.by };
    const length = Math.hypot(yAxis.x, yAxis.y);
    yAxis = length > 0 ? { x: yAxis.x / length, y: yAxis.y / length } : { x: 0, y: 0 };
    p.transform.bx = yAxis.x;
    p.transform.by = yAxis.y;
    // Vector2::orthogonal() is (y, -x).
    p.transform.ax = yAxis.y;
    p.transform.ay = -yAxis.x;
  } else {
    p.transform.ax = Math.cos(p.rotation);
    p.transform.ay = -Math.sin(p.rotation);
    p.transform.bx = Math.sin(p.rotation);
    p.transform.by = Math.cos(p.rotation);
  }

  const scaleParam = props.params[CPUParticles2DParam.Scale]!;
  const amount = lerp(scaleParam.min, scaleParam.max, p.scaleRand);
  // Godot floors each axis so a zero-scale quad never collapses the basis
  // (cpu_particles_2d.cpp:1142-1147). ONE value here, not the engine's
  // `Vector2 base_scale`: its axes only diverge under `split_scale`, and this
  // port derives `texScale` from the single Scale curve.
  const scale = Math.max(0.00001, texScale * amount);
  p.transform.ax *= scale;
  p.transform.ay *= scale;
  p.transform.bx *= scale;
  p.transform.by *= scale;
}

function multiplyColor(a: Color, b: Color): Color {
  return { r: a.r * b.r, g: a.g * b.g, b: a.b * b.b, a: a.a * b.a };
}

/**
 * Godot's YIQ-style hue rotation: three constant bases blended by cos/sin of
 * the angle, then applied with `Basis::xform_inv` (i.e. the TRANSPOSE).
 */
function rotateHue(color: Color, angle: number): Color {
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  // The three luminance constants each basis row is built from.
  const lr = 0.299;
  const lg = 0.587;
  const lb = 0.114;

  // Columns of the blended basis. Godot applies it with `Basis::xform_inv`, the
  // TRANSPOSE, so each output channel reads down a column rather than across a row.
  const xr = lr + 0.701 * c + 0.168 * s;
  const xg = lg + -0.587 * c + 0.33 * s;
  const xb = lb + -0.114 * c + -0.497 * s;

  const yr = lr + -0.299 * c + -0.328 * s;
  const yg = lg + 0.413 * c + 0.035 * s;
  const yb = lb + -0.114 * c + 0.292 * s;

  const zr = lr + -0.3 * c + 1.25 * s;
  const zg = lg + -0.588 * c + -1.05 * s;
  const zb = lb + 0.886 * c + -0.203 * s;

  return {
    r: xr * color.r + yr * color.g + zr * color.b,
    g: xg * color.r + yg * color.g + zg * color.b,
    b: xb * color.r + yb * color.g + zb * color.b,
    a: color.a,
  };
}
