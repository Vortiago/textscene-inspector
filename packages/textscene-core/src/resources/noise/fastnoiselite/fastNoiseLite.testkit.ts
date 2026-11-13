/** A FastNoiseLite a test writes as property lines, read through its kind as a reader reads it. */

import { loadedValue } from '../../reading/reading.testkit';
import { FAST_NOISE_LITE } from './decode';
import type { FastNoiseLiteData } from './types';

/** The FastNoiseLite whose `.tres` property lines are `properties`. */
export function fastNoiseLiteOf(properties: Readonly<Record<string, string>>): FastNoiseLiteData {
  const lines = Object.entries(properties).map(([name, value]) => `${name} = ${value}`);
  const scene = `[sub_resource type="FastNoiseLite" id="noise"]\n${lines.join('\n')}\n`;
  return loadedValue(FAST_NOISE_LITE, 'SubResource("noise")', scene);
}
