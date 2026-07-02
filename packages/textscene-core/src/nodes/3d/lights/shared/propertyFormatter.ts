/**
 * Shared property formatting utilities for light nodes.
 */

import type { PropertySection } from '../../../../core/NodeRegistry';
import type { BaseLightProperties, BaseLightWithNormalBias } from './types';

/**
 * Formats base light properties (color, energy) into a property section.
 *
 * @param properties - Light properties to format
 * @param additionalItems - Optional additional items to append to the section
 * @returns Formatted property section for display
 */
export function formatBaseLightSection(
  properties: BaseLightProperties,
  additionalItems?: PropertySection['items']
): PropertySection {
  const items: PropertySection['items'] = [
    { label: 'Color', value: properties.light_color },
    { label: 'Energy', value: properties.light_energy.toFixed(2) },
  ];

  if (properties.light_negative !== undefined) {
    items.push({ label: 'Negative', value: properties.light_negative ? 'Yes' : 'No' });
  }

  if (properties.light_specular !== undefined) {
    items.push({ label: 'Specular', value: properties.light_specular.toFixed(2) });
  }

  if (properties.light_volumetric_fog_energy !== undefined) {
    items.push({
      label: 'Volumetric Fog Energy',
      value: properties.light_volumetric_fog_energy.toFixed(2),
    });
  }

  if (additionalItems) {
    items.push(...additionalItems);
  }

  return {
    title: 'Light',
    items,
  };
}

/**
 * Formats base shadow properties into a property section.
 *
 * @param properties - Light properties with shadow settings
 * @param additionalItems - Optional additional shadow items to append
 * @returns Formatted shadow property section
 */
export function formatBaseShadowSection(
  properties: BaseLightProperties,
  additionalItems?: PropertySection['items']
): PropertySection {
  const items: PropertySection['items'] = [
    { label: 'Enabled', value: properties.shadow_enabled ? 'Yes' : 'No' },
  ];

  if (properties.shadow_bias !== undefined) {
    items.push({ label: 'Bias', value: properties.shadow_bias.toFixed(3) });
  }

  if (properties.shadow_blur !== undefined) {
    items.push({ label: 'Blur', value: properties.shadow_blur.toFixed(2) });
  }

  if (additionalItems) {
    items.push(...additionalItems);
  }

  return {
    title: 'Shadows',
    items,
  };
}

/**
 * Formats shadow section including normal bias.
 *
 * Used by DirectionalLight3D and OmniLight3D which support shadow_normal_bias.
 *
 * @param properties - Light properties with normal bias support
 * @param additionalItems - Optional additional shadow items to append
 * @returns Formatted shadow property section with normal bias
 */
export function formatShadowSectionWithNormalBias(
  properties: BaseLightWithNormalBias,
  additionalItems?: PropertySection['items']
): PropertySection {
  const items: PropertySection['items'] = [
    { label: 'Enabled', value: properties.shadow_enabled ? 'Yes' : 'No' },
  ];

  if (properties.shadow_bias !== undefined) {
    items.push({ label: 'Bias', value: properties.shadow_bias.toFixed(3) });
  }

  if (properties.shadow_normal_bias !== undefined) {
    items.push({
      label: 'Normal Bias',
      value: properties.shadow_normal_bias.toFixed(3),
    });
  }

  if (properties.shadow_blur !== undefined) {
    items.push({ label: 'Blur', value: properties.shadow_blur.toFixed(2) });
  }

  if (additionalItems) {
    items.push(...additionalItems);
  }

  return {
    title: 'Shadows',
    items,
  };
}
