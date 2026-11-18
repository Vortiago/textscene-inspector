import type { ShaderText } from '../materials/shadermaterial/types';
import type { SkyUsage } from '../../shaders/sky/skyUsage';
import type { REAL_TIME_RADIANCE_SIZE } from '../../godot/rendering/environment/skyReflection';
import type { SkyProcessMode } from '../../godot/rendering/environment/skyRadianceUpdate';
import type { Rgba } from '../../godot/math/math';

export interface ProceduralSkyProperties {
  kind: 'procedural';
  sky_top_color: Rgba;
  sky_horizon_color: Rgba;
  sky_curve: number;
  sky_energy_multiplier: number;
  ground_bottom_color: Rgba;
  ground_horizon_color: Rgba;
  ground_curve: number;
  ground_energy_multiplier: number;
  /** Degrees. Godot uploads its cosine. */
  sun_angle_max: number;
  sun_curve: number;
  /** The sky's overall exposure. */
  energy_multiplier: number;
  /** Whether Godot adds its debanding noise to the drawn sky. */
  use_debanding: boolean;
}

export interface PanoramaSkyProperties {
  kind: 'panorama';
  /** An equirectangular Texture2D reference, or undefined for an unset sky. */
  panorama: string | undefined;
  /** Whether the panorama samples with linear filtering, else nearest (`sky_material.cpp:498-505`). */
  filter: boolean;
  energy_multiplier: number;
}

export interface PhysicalSkyProperties {
  kind: 'physical';
  rayleigh_coefficient: number;
  rayleigh_color: Rgba;
  mie_coefficient: number;
  mie_eccentricity: number;
  mie_color: Rgba;
  turbidity: number;
  sun_disk_scale: number;
  ground_color: Rgba;
  energy_multiplier: number;
  /** Whether Godot adds its debanding noise to the drawn sky. */
  use_debanding: boolean;
}

/** A ShaderMaterial whose shader is `shader_type sky`. */
export interface ShaderSkyText extends ShaderText {
  kind: 'shader';
}

/** A sky shader with what the transpiler, which the previewer loads on demand, reads of it. */
export interface ShaderSkyProperties extends ShaderSkyText {
  /** The built-ins the shader reads that decide when Godot draws or bakes it again. */
  usage: SkyUsage;
}

export type SkyProperties =
  ProceduralSkyProperties | PanoramaSkyProperties | PhysicalSkyProperties | ShaderSkyProperties;

/** A sky material the previewer draws with its own GLSL, not through the transpiler. */
export type BuiltInSkyProperties = Exclude<SkyProperties, ShaderSkyProperties>;

/** A sky material as the file writes it, before the transpiler reads a shader. */
export type AuthoredSkyProperties = BuiltInSkyProperties | ShaderSkyText;

/** The `Sky` resource's own properties, which decide how Godot bakes its radiance layers. */
export interface SkyProcessing {
  processMode: SkyProcessMode;
  /** The radiance's size in pixels, which `radiance_size` names by index. */
  radianceSize: number;
}

/**
 * How Godot bakes a sky's radiance layers: GGX importance sampling, or the fast filter. The fast
 * filter comes only with a real-time sky, which Godot bakes at `REAL_TIME_RADIANCE_SIZE` whatever
 * its `radiance_size` (`sky.cpp:590-592`).
 */
export type SkyBake =
  | { radianceFilter: 'fast'; radianceSize: typeof REAL_TIME_RADIANCE_SIZE }
  | { radianceFilter: 'importance-sample'; radianceSize: number };

/** A Godot `Sky` as the renderer draws it: its material, and how its radiance layers bake. */
export type Sky<Material extends AuthoredSkyProperties = SkyProperties> = {
  material: Material;
  processMode: SkyProcessMode;
} & SkyBake;

/** A Sky as the file writes it, whose shader the transpiler has not read. */
export type AuthoredSky = Sky<AuthoredSkyProperties>;
