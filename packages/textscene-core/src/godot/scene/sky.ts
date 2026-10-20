/** Godot 4.6.3's Sky resource: its radiance sizes, process modes and its class default. */

import { enumNamesByValue } from '../classdb/enumNames.js';

/** The size each `Sky::RadianceSize` names, by its value (`scene/resources/sky.cpp:37-39`). */
export const SKY_RADIANCE_SIZES: readonly number[] = [32, 64, 128, 256, 512, 1024, 2048];

/** RADIANCE_SIZE_256, the default of `Sky.radiance_size` (`scene/resources/sky.h:61`). */
export const SKY_RADIANCE_SIZE_DEFAULT = 256;

/** `Sky::ProcessMode` (`sky.h:51-56`). */
const ProcessMode = {
  PROCESS_MODE_AUTOMATIC: 0,
  PROCESS_MODE_QUALITY: 1,
  PROCESS_MODE_INCREMENTAL: 2,
  PROCESS_MODE_REALTIME: 3,
} as const;

export const SKY_PROCESS_MODE_NAMES = enumNamesByValue(ProcessMode);

/** Each `Sky::RadianceSize` constant by its index, spelled from the size it names (`sky.h:40-49`, no `RADIANCE_SIZE_MAX`). */
export const SKY_RADIANCE_SIZE_NAMES: Readonly<Record<number, string>> = Object.freeze(
  Object.fromEntries(SKY_RADIANCE_SIZES.map((size, index) => [index, `RADIANCE_SIZE_${size}`]))
);
