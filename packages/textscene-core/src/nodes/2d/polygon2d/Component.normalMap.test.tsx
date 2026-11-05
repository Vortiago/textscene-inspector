/**
 * A Polygon2D whose texture is a CanvasTexture: it declares itself normal-mapped while the
 * CanvasTexture names a normal map (`canvas.glsl:652-665`), and samples with the CanvasTexture's own
 * filter where it names one (`texture_storage.cpp:737`).
 */
import './index';
import { Polygon2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import {
  CANVAS_TEXTURE_REF,
  describeCanvasTextureItem,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../../parser/types';

function render(wrapper: TscnInternalResource) {
  const polygon = parsedNode(
    { type: 'Polygon2D', name: 'P' },
    { texture: CANVAS_TEXTURE_REF, polygon: 'PackedVector2Array(-4, -4, 4, -4, 4, 4, -4, 4)' }
  );
  return renderLitItem(<Polygon2D node={polygon} />, [wrapper]);
}

describeCanvasTextureItem('Polygon2D', render);
