/**
 * AudioStreamPlayer property formatter: the sections the details panel
 * shows. AudioStreamPlayer is non-spatial (no visual representation),
 * so it calls out the "not played in preview" status.
 */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { AudioStreamPlayerProperties } from './types';
import { audioMixingSection, audioStreamSection } from '../audioStreamSection';

export function formatAudioStreamPlayerProperties(
  properties: AudioStreamPlayerProperties
): PropertySection[] {
  return [audioStreamSection(properties), audioMixingSection(properties)];
}
