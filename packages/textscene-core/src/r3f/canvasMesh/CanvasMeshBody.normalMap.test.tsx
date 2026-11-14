/**
 * A `CanvasMeshBody` with a CanvasTexture is normal-mapped while it names a normal map
 * (`canvas.glsl:652-665`), and samples with its own filter (`texture_storage.cpp:737`). Every drawer
 * of the body lights this way, so a drawer tests only that it hands the body its texture.
 */
import {
  CANVAS_TEXTURE_REF,
  describeCanvasTextureItem,
  renderLitItem,
} from '../testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../parser/types';
import { TestDrawer } from './testDrawer.testkit';

function render(wrapper: TscnInternalResource) {
  return renderLitItem(<TestDrawer texture={CANVAS_TEXTURE_REF} />, [wrapper]);
}

describeCanvasTextureItem('CanvasMeshBody', render);
