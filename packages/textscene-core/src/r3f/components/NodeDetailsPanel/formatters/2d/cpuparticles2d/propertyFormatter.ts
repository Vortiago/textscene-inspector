import {
  CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES,
  CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES,
  CPUParticles2DEmissionShape,
} from '../../../../../../godot/scene/particles2d';
import { PARAM_SLOTS } from '../../../../../../nodes/shared/cpuparticles/params';
import type { InspectedNode, NodeValues, PropertyItem, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { realText, resourceText, rgbaText, tupleText, yesNo } from '../../valueText';

const PARTICLES_PROPERTIES = [
  'emitting',
  'amount',
  'lifetime',
  'one_shot',
  'preprocess',
  'speed_scale',
  'explosiveness',
  'randomness',
  'lifetime_randomness',
  'use_fixed_seed',
  'seed',
  'fixed_fps',
  'fract_delta',
  'local_coords',
  'draw_order',
  'emission_shape',
  'emission_sphere_radius',
  'emission_rect_extents',
  'emission_ring_radius',
  'emission_ring_inner_radius',
  'direction',
  'spread',
  'gravity',
  'particle_flag_align_y',
  'color',
  'color_ramp',
  'color_initial_ramp',
  'texture',
] as const;

type ParticlesValues = NodeValues<(typeof PARTICLES_PROPERTIES)[number]>;

export async function formatCPUParticles2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  const values = await node.read(PARTICLES_PROPERTIES);
  const drawOrder = values.number('draw_order');
  const shape = values.number('emission_shape');
  const sections: PropertySection[] = [
    {
      title: 'Particles',
      items: [
        { label: 'Emitting', value: yesNo(values.boolean('emitting')) },
        { label: 'Amount', value: String(values.number('amount')) },
        { label: 'Lifetime', value: `${values.number('lifetime').toFixed(2)} s` },
        { label: 'One Shot', value: yesNo(values.boolean('one_shot')) },
        { label: 'Preprocess', value: `${values.number('preprocess').toFixed(2)} s` },
        { label: 'Speed Scale', value: values.number('speed_scale').toFixed(2) },
        { label: 'Explosiveness', value: values.number('explosiveness').toFixed(2) },
        { label: 'Randomness', value: values.number('randomness').toFixed(2) },
        { label: 'Lifetime Randomness', value: values.number('lifetime_randomness').toFixed(2) },
        {
          label: 'Seed',
          value: values.boolean('use_fixed_seed') ? String(values.number('seed')) : 'randomised',
        },
        { label: 'Fixed FPS', value: fixedFpsText(values.number('fixed_fps')) },
        { label: 'Fract Delta', value: yesNo(values.boolean('fract_delta')) },
        { label: 'Local Coords', value: yesNo(values.boolean('local_coords')) },
        {
          label: 'Draw Order',
          value: CPU_PARTICLES_2D_DRAW_ORDER_HINT_NAMES[drawOrder] ?? String(drawOrder),
        },
      ],
    },
    {
      title: 'Emission',
      items: [
        { label: 'Shape', value: CPU_PARTICLES_2D_EMISSION_SHAPE_HINT_NAMES[shape] ?? String(shape) },
        ...emissionShapeItems(values, shape),
        { label: 'Direction', value: tupleText(values.numbers('direction')) },
        { label: 'Spread', value: `${values.number('spread').toFixed(1)}°` },
        { label: 'Gravity', value: tupleText(values.numbers('gravity')) },
        { label: 'Align Y', value: yesNo(values.boolean('particle_flag_align_y')) },
      ],
    },
    {
      title: 'Colour',
      items: [
        { label: 'Color', value: rgbaText(values.numbers('color')) },
        { label: 'Color Ramp', value: resourceText(values.resource('color_ramp')) },
        { label: 'Color Initial Ramp', value: resourceText(values.resource('color_initial_ramp')) },
        { label: 'Texture', value: resourceText(values.resource('texture')) },
      ],
    },
  ];
  const params = await paramItems(node);
  if (params.length > 0) sections.push({ title: 'Parameters', items: params });
  return [...sections, ...(await formatNode2DProperties(node))];
}

function fixedFpsText(fixedFps: number): string {
  return fixedFps === 0 ? '30 (default)' : String(fixedFps);
}

function emissionShapeItems(values: ParticlesValues, shape: number): PropertyItem[] {
  switch (shape) {
    case CPUParticles2DEmissionShape.SPHERE:
    case CPUParticles2DEmissionShape.SPHERE_SURFACE:
      return [{ label: 'Sphere Radius', value: values.number('emission_sphere_radius').toFixed(2) }];
    case CPUParticles2DEmissionShape.RECTANGLE:
      return [{ label: 'Rect Extents', value: tupleText(values.numbers('emission_rect_extents')) }];
    case CPUParticles2DEmissionShape.RING:
      return [
        { label: 'Ring Radius', value: values.number('emission_ring_radius').toFixed(2) },
        { label: 'Ring Inner Radius', value: values.number('emission_ring_inner_radius').toFixed(2) },
      ];
    default:
      return [];
  }
}

/** Each parameter whose range or curve moves off Godot's default. Initial Velocity has no curve. */
async function paramItems(node: InspectedNode): Promise<PropertyItem[]> {
  const names = PARAM_SLOTS.flatMap(({ prefix, curve }) => [
    `${prefix}_min`,
    `${prefix}_max`,
    ...(curve ? [`${prefix}_curve`] : []),
  ]);
  const values = await node.read(names);
  return PARAM_SLOTS.flatMap(({ prefix, label, def, curve }) => {
    const [min, max] = [values.number(`${prefix}_min`), values.number(`${prefix}_max`)];
    const hasCurve = curve && values.resource(`${prefix}_curve`) !== null;
    if (min === def && max === def && !hasCurve) return [];
    const range = min === max ? realText(min) : `${realText(min)} … ${realText(max)}`;
    return [{ label, value: hasCurve ? `${range} × curve` : range }];
  });
}
