/**
 * A Sprite2D with no texture draws nothing (`sprite_2d.cpp:159`), so it asks the light pass for
 * no accumulation.
 */
import { describe, expect, it } from 'vitest';
import './index';
import { Sprite2D } from './Component';
import { parsedNode } from '../../../parser/testing/parserKit';
import {
  CANVAS_TEXTURE_REF,
  itHandsTheBodyItsCanvasTexture,
  renderLitItem,
  renderOnLitCanvas,
} from '../../../r3f/testing/canvasTextureLighting';
import type { TscnInternalResource } from '../../../parser/types';

describe('Sprite2D with no texture', () => {
  it('registers no light read', async () => {
    const sprite = parsedNode({ type: 'Sprite2D', name: 'S' }, {});
    const canvas = await renderOnLitCanvas(<Sprite2D node={sprite} />, []);
    expect(canvas.registerItem).not.toHaveBeenCalled();
  });
});

describe('Sprite2D with a CanvasTexture', () => {
  itHandsTheBodyItsCanvasTexture((wrapper: TscnInternalResource) => {
    const sprite = parsedNode({ type: 'Sprite2D', name: 'S' }, { texture: CANVAS_TEXTURE_REF });
    return renderLitItem(<Sprite2D node={sprite} />, [wrapper]);
  });
});
