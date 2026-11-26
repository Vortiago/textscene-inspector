import { GODOT_VERSION } from '../language/instructionTable.generated.js';

/** A CanvasItemMaterial's properties, each as Godot stores it: a value past a switch writes nothing. */
export interface CanvasItemMaterialSettings {
  readonly blendMode: number;
  readonly lightMode: number;
  readonly particlesAnimation: boolean;
  readonly particlesAnimHFrames: number;
  readonly particlesAnimVFrames: number;
  readonly particlesAnimLoop: boolean;
}

/** The text and the `shader_parameter` values, as Variant text, Godot gives a CanvasItemMaterial. */
export interface CanvasItemMaterialShader {
  readonly code: string;
  readonly parameters: Readonly<Record<string, string>>;
}

const BLEND_MODES: readonly string[] = [
  'blend_mix',
  'blend_add',
  'blend_sub',
  'blend_mul',
  'blend_premul_alpha',
  'blend_disabled',
];

const LIGHT_MODES: readonly string[] = ['', ',unshaded', ',light_only'];

/** `canvas_item_material.cpp:118-136`, with Godot's missing line break after the `else` block kept. */
const PARTICLES_ANIMATION = `uniform int particles_anim_h_frames;
uniform int particles_anim_v_frames;
uniform bool particles_anim_loop;

void vertex() {
	float h_frames = float(particles_anim_h_frames);
	float v_frames = float(particles_anim_v_frames);
	VERTEX.xy /= vec2(h_frames, v_frames);
	float particle_total_frames = float(particles_anim_h_frames * particles_anim_v_frames);
	float particle_frame = floor(INSTANCE_CUSTOM.z * float(particle_total_frames));
	if (!particles_anim_loop) {
		particle_frame = clamp(particle_frame, 0.0, particle_total_frames - 1.0);
	} else {
		particle_frame = mod(particle_frame, particle_total_frames);
	}	UV /= vec2(h_frames, v_frames);
	UV += vec2(mod(particle_frame, h_frames) / h_frames, floor((particle_frame + 0.5) / h_frames) / v_frames);
}
`;

/**
 * Godot's setters upload the particle parameters whether or not the text declares them (`:199-224`).
 * @canonical Write the shader text of a CanvasItemMaterial (`canvas_item_material.cpp:55`).
 */
export function canvasItemMaterialShader(material: CanvasItemMaterialSettings): CanvasItemMaterialShader {
  return { code: shaderText(material), parameters: particleParameters(material) };
}

function shaderText({ blendMode, lightMode, particlesAnimation }: CanvasItemMaterialSettings): string {
  return (
    `// NOTE: Shader automatically converted from Godot Engine ${GODOT_VERSION}.stable's CanvasItemMaterial.\n\n` +
    `shader_type canvas_item;\nrender_mode ${BLEND_MODES[blendMode] ?? ''}${LIGHT_MODES[lightMode] ?? ''};\n` +
    (particlesAnimation ? PARTICLES_ANIMATION : '')
  );
}

function particleParameters(material: CanvasItemMaterialSettings): Record<string, string> {
  return {
    particles_anim_h_frames: String(material.particlesAnimHFrames),
    particles_anim_v_frames: String(material.particlesAnimVFrames),
    particles_anim_loop: String(material.particlesAnimLoop),
  };
}
