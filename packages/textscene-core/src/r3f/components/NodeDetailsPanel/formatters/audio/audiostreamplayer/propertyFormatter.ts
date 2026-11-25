import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { audioMixingSection, audioStreamSection } from '../shared/audioSections';

export async function formatAudioStreamPlayerProperties(node: InspectedNode): Promise<PropertySection[]> {
  return [await audioStreamSection(node), await audioMixingSection(node)];
}
