/**
 * A Polygon2D whose texture is set draws the missing-resource placeholder when the texture fails,
 * and nothing while it arrives, as every canvas mesh drawer does.
 */
import { describe, expect, it } from 'vitest';
import { Polygon2D } from './Component';
import { parsePolygon2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import type { TscnNode } from '../../../parser/types';
import {
  placeholderMeshes,
  renderWithTexture,
  TEXTURE_REFERENCE,
} from '../../../r3f/canvasMesh/textureLoadStates.testkit';

const TEXTURED: TscnNode = {
  rawProperties: {},
  name: 'Poly',
  type: 'Polygon2D',
  children: [],
  properties: parsePolygon2D(heading('Polygon2D', { name: 'Poly' }), {
    polygon: 'PackedVector2Array(0, 0, 64, 0, 64, 64, 0, 64)',
    texture: TEXTURE_REFERENCE,
  }),
};

describe('Polygon2D with a texture that does not load', () => {
  it('draws the missing-resource placeholder for a texture that fails', async () => {
    const { renderer } = await renderWithTexture(<Polygon2D node={TEXTURED} />, 'failed');

    expect(placeholderMeshes(renderer)).toHaveLength(1);
  });

  it('draws nothing while the texture arrives', async () => {
    const { renderer } = await renderWithTexture(<Polygon2D node={TEXTURED} />, 'arriving');

    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });
});
