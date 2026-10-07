/** Formats DirectionalLight2D properties for the details panel: the Light2D surface and its own two members. */

import type { PropertySection } from '../../../core/NodeRegistry';
import type { DirectionalLight2DProperties } from './types';
import { formatLight2DProperties } from '../lights/shared/propertyFormatter';

export function formatDirectionalLight2DProperties(props: DirectionalLight2DProperties): PropertySection[] {
  return formatLight2DProperties(props, [
    { label: 'Height', value: props.height.toFixed(2) },
    { label: 'Max Distance', value: `${props.max_distance.toFixed(0)} px` },
  ]);
}
