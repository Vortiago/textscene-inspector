/**
 * CPUParticles2D property formatter — the emitter surface for the Inspector,
 * above the shared Node2D sections.
 *
 * The twelve parameter slots are listed only when they are non-default: a
 * particle node has forty-odd properties and all but a handful are Godot's
 * defaults, so printing every range would bury the four the author changed.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { formatColorRgba } from '../../../utils/colorParser';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import {
  CPUParticles2DDrawOrder,
  CPUParticles2DEmissionShape,
  type CPUParticles2DProperties,
} from './types';

const SHAPE_LABELS: Record<number, string> = {
  [CPUParticles2DEmissionShape.Point]: 'Point',
  [CPUParticles2DEmissionShape.Sphere]: 'Sphere',
  [CPUParticles2DEmissionShape.SphereSurface]: 'Sphere Surface',
  [CPUParticles2DEmissionShape.Rectangle]: 'Rectangle',
  [CPUParticles2DEmissionShape.Points]: 'Points',
  [CPUParticles2DEmissionShape.DirectedPoints]: 'Directed Points',
  [CPUParticles2DEmissionShape.Ring]: 'Ring',
};

const DRAW_ORDER_LABELS: Record<number, string> = {
  [CPUParticles2DDrawOrder.Index]: 'Index',
  [CPUParticles2DDrawOrder.Lifetime]: 'Lifetime',
};

/** Display label and Godot default for each parameter slot, in enum order. */
const PARAM_LABELS: ReadonlyArray<{ label: string; def: number }> = [
  { label: 'Initial Velocity', def: 0 },
  { label: 'Angular Velocity', def: 0 },
  { label: 'Orbit Velocity', def: 0 },
  { label: 'Linear Accel', def: 0 },
  { label: 'Radial Accel', def: 0 },
  { label: 'Tangential Accel', def: 0 },
  { label: 'Damping', def: 0 },
  { label: 'Angle', def: 0 },
  { label: 'Scale Amount', def: 1 },
  { label: 'Hue Variation', def: 0 },
  { label: 'Anim Speed', def: 0 },
  { label: 'Anim Offset', def: 0 },
];

export function formatCPUParticles2DProperties(
  props: CPUParticles2DProperties
): PropertySection[] {
  const sections: PropertySection[] = [
    {
      title: 'Particles',
      items: [
        { label: 'Emitting', value: props.emitting ? 'Yes' : 'No' },
        { label: 'Amount', value: String(props.amount) },
        { label: 'Lifetime', value: `${props.lifetime.toFixed(2)} s` },
        { label: 'One Shot', value: props.one_shot ? 'Yes' : 'No' },
        { label: 'Preprocess', value: `${props.preprocess.toFixed(2)} s` },
        { label: 'Speed Scale', value: props.speed_scale.toFixed(2) },
        { label: 'Explosiveness', value: props.explosiveness.toFixed(2) },
        { label: 'Randomness', value: props.randomness.toFixed(2) },
        { label: 'Lifetime Randomness', value: props.lifetime_randomness.toFixed(2) },
        {
          label: 'Seed',
          value: props.use_fixed_seed ? String(props.seed) : 'randomised',
        },
        { label: 'Fixed FPS', value: props.fixed_fps === 0 ? '30 (default)' : String(props.fixed_fps) },
        { label: 'Fract Delta', value: props.fract_delta ? 'Yes' : 'No' },
        { label: 'Local Coords', value: props.local_coords ? 'Yes' : 'No' },
        {
          label: 'Draw Order',
          value: DRAW_ORDER_LABELS[props.draw_order] ?? String(props.draw_order),
        },
      ],
    },
    {
      title: 'Emission',
      items: [
        {
          label: 'Shape',
          value: SHAPE_LABELS[props.emission_shape] ?? String(props.emission_shape),
        },
        ...emissionShapeItems(props),
        { label: 'Direction', value: `(${props.direction.x}, ${props.direction.y})` },
        { label: 'Spread', value: `${props.spread.toFixed(1)}°` },
        { label: 'Gravity', value: `(${props.gravity.x}, ${props.gravity.y})` },
        { label: 'Align Y', value: props.particle_flag_align_y ? 'Yes' : 'No' },
      ],
    },
    {
      title: 'Colour',
      items: [
        { label: 'Color', value: formatColorRgba(props.color) },
        { label: 'Color Ramp', value: props.color_ramp ?? '(none)' },
        { label: 'Color Initial Ramp', value: props.color_initial_ramp ?? '(none)' },
        { label: 'Texture', value: props.texture ?? '(none)' },
      ],
    },
  ];

  const params = formatParams(props);
  if (params.length > 0) sections.push({ title: 'Parameters', items: params });

  sections.push(...formatNode2DProperties(props));
  return sections;
}

function emissionShapeItems(
  props: CPUParticles2DProperties
): Array<{ label: string; value: string }> {
  switch (props.emission_shape) {
    case CPUParticles2DEmissionShape.Sphere:
    case CPUParticles2DEmissionShape.SphereSurface:
      return [{ label: 'Sphere Radius', value: props.emission_sphere_radius.toFixed(2) }];
    case CPUParticles2DEmissionShape.Rectangle:
      return [
        {
          label: 'Rect Extents',
          value: `(${props.emission_rect_extents.x}, ${props.emission_rect_extents.y})`,
        },
      ];
    case CPUParticles2DEmissionShape.Ring:
      return [
        { label: 'Ring Radius', value: props.emission_ring_radius.toFixed(2) },
        { label: 'Ring Inner Radius', value: props.emission_ring_inner_radius.toFixed(2) },
      ];
    default:
      return [];
  }
}

function formatParams(
  props: CPUParticles2DProperties
): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  for (let i = 0; i < PARAM_LABELS.length; i++) {
    const slot = props.params[i];
    const meta = PARAM_LABELS[i]!;
    if (!slot) continue;
    const isDefault = slot.min === meta.def && slot.max === meta.def && !slot.curve;
    if (isDefault) continue;
    const range = slot.min === slot.max ? String(slot.min) : `${slot.min} … ${slot.max}`;
    items.push({
      label: meta.label,
      value: slot.curve ? `${range} × curve` : range,
    });
  }
  return items;
}
