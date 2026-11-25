/** DirectionalLight2D registration: its own parser and formatter, and a component that draws. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseDirectionalLight2D } from './parser';
import { formatDirectionalLight2DProperties } from '../../../r3f/components/NodeDetailsPanel/formatters/2d/directionallight2d/propertyFormatter';
import { formatterOf } from '../../../r3f/components/NodeDetailsPanel/formatters/index';
import { DirectionalLight2D } from './Component';
import './index';
import './index.r3f';

describe('DirectionalLight2D registration', () => {
  it('registers its own parser, and the inspector has its formatter', () => {
    const registration = nodeRegistry.getRegistration('DirectionalLight2D');
    expect(registration!.parser).toBe(parseDirectionalLight2D);
    expect(formatterOf('DirectionalLight2D')).toBe(formatDirectionalLight2DProperties);
  });

  it('registers the component that draws its light', () => {
    expect(nodeComponentRegistry.get('DirectionalLight2D')).toBe(DirectionalLight2D);
    expect(nodeComponentRegistry.renderIntentOf('DirectionalLight2D')).toBe('draws');
    expect(rendersOwnVisual('DirectionalLight2D')).not.toBe('not-implemented');
  });
});
