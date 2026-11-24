import type { ShaderSkyText, Sky, SkyBake, SkyProcessing } from './types';
import {
  automaticSkyMode,
  type SkyProcessMode,
  type SkyUpdateMode,
} from '../../godot/rendering/environment/skyRadianceUpdate';
import { REAL_TIME_RADIANCE_SIZE } from '../../godot/rendering/environment/skyReflection';
import { SKY_RADIANCE_SIZES, SKY_RADIANCE_SIZE_DEFAULT } from '../../godot/scene/sky';
import { parseOptionalInt } from '../../parser/valueParsers';

/** `Sky::ProcessMode` by its value (`scene/resources/sky.h:51-56`). */
const PROCESS_MODES: readonly SkyProcessMode[] = ['automatic', 'quality', 'incremental', 'real-time'];

/**
 * A `Sky`'s process mode and radiance size. An invalid value reads as Godot's default and logs
 * nothing, as the Sky validators report it. `set_radiance_size` refuses an index past the table
 * (`sky.cpp:34`), so such a size stays at the default.
 */
export function decodeSkyProcessing(data: Record<string, string>): SkyProcessing {
  return {
    processMode: entryOr(PROCESS_MODES, data.process_mode, 'automatic'),
    radianceSize: entryOr(SKY_RADIANCE_SIZES, data.radiance_size, SKY_RADIANCE_SIZE_DEFAULT),
  };
}

/** The entry of `table` that the int `value` indexes, or `fallback`. */
function entryOr<T>(table: readonly T[], value: string | undefined, fallback: T): T {
  const index = parseOptionalInt(value);
  return (index === undefined ? undefined : table[index]) ?? fallback;
}

/**
 * The `Sky` whose properties are `data`, drawing `material`. An invalid value reads as
 * `decodeSkyProcessing` reads it.
 */
export function decodeSky<Material extends ShaderSkyText>(
  data: Record<string, string>,
  material: Material
): Sky<Material> {
  const processing = decodeSkyProcessing(data);
  return { material, processMode: processing.processMode, ...skyBake(processing) };
}

/** How Godot bakes the layers (`sky.cpp:1335-1344`): only a real-time sky takes the fast filter. */
function skyBake({ processMode, radianceSize }: SkyProcessing): SkyBake {
  return processMode === 'real-time' ? REAL_TIME_BAKE : { radianceFilter: 'importance-sample', radianceSize };
}

const REAL_TIME_BAKE: SkyBake = { radianceFilter: 'fast', radianceSize: REAL_TIME_RADIANCE_SIZE };

/** The mode Godot runs `sky` in: Automatic resolves from the material and the scene's fog. */
export function skyUpdateMode(sky: Sky, fogScattersSun: boolean): SkyUpdateMode {
  if (sky.processMode !== 'automatic') return sky.processMode;
  return automaticSkyMode({ ...sky.material.usage, radianceSize: sky.radianceSize, fogScattersSun });
}

/** `sky` with the fast filter when Automatic runs it real-time, which the scene's fog never decides. */
export function withAutomaticBake(sky: Sky): Sky {
  return sky.processMode === 'automatic' && skyUpdateMode(sky, false) === 'real-time'
    ? { ...sky, ...REAL_TIME_BAKE }
    : sky;
}
