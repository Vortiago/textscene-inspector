/**
 * CPUParticles2D property formatter: the emitter properties for the Inspector,
 * above the shared Node2D sections. A parameter slot shows only when it differs
 * from Godot's default, so the few the author changed are not buried.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import { formatColorRgba } from '../../../utils/colorParser';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { type CPUParticles2DProperties, PARAM_SLOTS } from './types';
import {
  CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES,
  CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES,
  CPUParticles2DEmissionShape,
} from '../../../godot/scene/particles2d';

export function formatCPUParticles2DProperties(props: CPUParticles2DProperties): PropertySection[] {
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
          value: CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES[props.draw_order] ?? String(props.draw_order),
        },
      ],
    },
    {
      title: 'Emission',
      items: [
        {
          label: 'Shape',
          value:
            CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES[props.emission_shape] ?? String(props.emission_shape),
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

function emissionShapeItems(props: CPUParticles2DProperties): Array<{ label: string; value: string }> {
  switch (props.emission_shape) {
    case CPUParticles2DEmissionShape.SPHERE:
    case CPUParticles2DEmissionShape.SPHERE_SURFACE:
      return [{ label: 'Sphere Radius', value: props.emission_sphere_radius.toFixed(2) }];
    case CPUParticles2DEmissionShape.RECTANGLE:
      return [
        {
          label: 'Rect Extents',
          value: `(${props.emission_rect_extents.x}, ${props.emission_rect_extents.y})`,
        },
      ];
    case CPUParticles2DEmissionShape.RING:
      return [
        { label: 'Ring Radius', value: props.emission_ring_radius.toFixed(2) },
        { label: 'Ring Inner Radius', value: props.emission_ring_inner_radius.toFixed(2) },
      ];
    default:
      return [];
  }
}

function formatParams(props: CPUParticles2DProperties): Array<{ label: string; value: string }> {
  const items: Array<{ label: string; value: string }> = [];
  for (let i = 0; i < PARAM_SLOTS.length; i++) {
    const slot = props.params[i];
    const meta = PARAM_SLOTS[i]!;
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
