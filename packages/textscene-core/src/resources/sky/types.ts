import type { ShaderText } from '../materials/shadermaterial/types';
import type { SkyUsage } from '../../shaders/sky/skyUsage';
import type { REAL_TIME_RADIANCE_SIZE } from '../../godot/rendering/environment/skyReflection';
import type { SkyProcessMode } from '../../godot/rendering/environment/skyRadianceUpdate';

/** A sky shader: a ShaderMaterial's of `shader_type sky`, or the one a sky material generates. */
export type ShaderSkyText = ShaderText;

/** A sky shader with what the transpiler, which the previewer loads on demand, reads of it. */
export interface ShaderSkyProperties extends ShaderSkyText {
  /** The built-ins the shader reads that decide when Godot draws or bakes it again. */
  usage: SkyUsage;
}

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
export type Sky<Material extends ShaderSkyText = ShaderSkyProperties> = {
  material: Material;
  processMode: SkyProcessMode;
} & SkyBake;

/** A Sky as the file writes it, whose shader the transpiler has not read. */
export type AuthoredSky = Sky<ShaderSkyText>;
