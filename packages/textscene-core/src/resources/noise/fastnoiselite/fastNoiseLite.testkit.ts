/** A FastNoiseLite a test writes as property lines, read through its kind as a reader reads it. */

import { decodedResource } from '../../reading/decodedResource.testkit';
import { FAST_NOISE_LITE } from './decode';
import type { FastNoiseLiteData } from './types';

export function fastNoiseLiteOf(properties: Record<string, string>): FastNoiseLiteData {
  const noise = decodedResource(FAST_NOISE_LITE, properties);
  if (!noise) throw new Error('expected the FastNoiseLite to decode, got nothing');
  return noise;
}
