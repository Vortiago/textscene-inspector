/**
 * A 2D light draws no pixels of its own, so neither light node asks the light pass to light it.
 */
import { describe, expect, it } from 'vitest';
import '../../nodes/2d/pointlight2d/index';
import '../../nodes/2d/directionallight2d/index';
import { PointLight2D } from '../../nodes/2d/pointlight2d/Component';
import { DirectionalLight2D } from '../../nodes/2d/directionallight2d/Component';
import { parsedNode } from '../../parser/testing/parserKit';
import { FLAT_GREY_REF, renderOnLitCanvas } from '../testing/canvasTextureLighting';
import { settleLoads } from '../testing/settleLoads';

describe('a light node', () => {
  it('registers no light read for a PointLight2D', async () => {
    const light = parsedNode({ type: 'PointLight2D', name: 'L' }, { texture: FLAT_GREY_REF });
    const canvas = await renderOnLitCanvas(<PointLight2D node={light} />, []);
    await settleLoads();
    expect(canvas.registerItem).not.toHaveBeenCalled();
  });

  it('registers no light read for a DirectionalLight2D', async () => {
    const light = parsedNode({ type: 'DirectionalLight2D', name: 'L' }, {});
    const canvas = await renderOnLitCanvas(<DirectionalLight2D node={light} />, []);
    expect(canvas.registerItem).not.toHaveBeenCalled();
  });
});
