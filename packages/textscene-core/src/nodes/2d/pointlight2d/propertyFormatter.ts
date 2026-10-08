/** Formats PointLight2D properties for the details panel: the Light2D surface and its texture scale. */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { PointLight2DProperties } from './types';
import { formatLight2DProperties } from '../lights/shared/propertyFormatter';

export function formatPointLight2DProperties(props: PointLight2DProperties): PropertySection[] {
  return formatLight2DProperties(props, [{ label: 'Texture Scale', value: props.texture_scale.toFixed(2) }]);
}
