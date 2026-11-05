/**
 * A Line2D whose texture is a CanvasTexture: it declares itself normal-mapped while the CanvasTexture
 * names a normal map (`canvas.glsl:652-665`), and samples with the CanvasTexture's own filter where
 * it names one (`texture_storage.cpp:737`).
 */
import './index';
import { Line2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import {
  CANVAS_TEXTURE_REF,
  describeCanvasTextureItem,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../../parser/types';

function render(wrapper: TscnInternalResource) {
  const line = parsedNode(
    { type: 'Line2D', name: 'L' },
    { texture: CANVAS_TEXTURE_REF, points: 'PackedVector2Array(0, 0, 0, 32)', width: '8.0' }
  );
  return renderLitItem(<Line2D node={line} />, [wrapper]);
}

describeCanvasTextureItem('Line2D', render);
