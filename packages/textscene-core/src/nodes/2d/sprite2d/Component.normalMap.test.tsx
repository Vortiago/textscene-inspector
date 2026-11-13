/**
 * A Sprite2D whose texture is a CanvasTexture: it draws the diffuse texture, declares itself
 * normal-mapped while the CanvasTexture names a normal map, and samples every map with the
 * CanvasTexture's own filter where it names one (`texture_storage.cpp:737`).
 */
import './index';
import { Sprite2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import {
  CANVAS_TEXTURE_REF,
  describeCanvasTextureItem,
  renderLitItem,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../../parser/types';

function render(wrapper: TscnInternalResource) {
  const sprite = parsedNode({ type: 'Sprite2D', name: 'S' }, { texture: CANVAS_TEXTURE_REF });
  return renderLitItem(<Sprite2D node={sprite} />, [wrapper]);
}

describeCanvasTextureItem('Sprite2D', render);
