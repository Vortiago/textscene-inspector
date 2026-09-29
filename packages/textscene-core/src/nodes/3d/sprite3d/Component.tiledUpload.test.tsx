/**
 * Sprite3D over a sheet large enough to upload in bands: a frame change moves the
 * UV window over the same pixels, so it neither restarts the upload nor copies a
 * row twice, and the sprite draws even while its frame changes every frame.
 */
import { describe, expect, it } from 'vitest';
import { parseSprite3D } from './parser';
import { Sprite3D } from './Component';
import {
  mountSheetSprite,
  SHEET_BANDS,
  SHEET_HEIGHT,
  SHEET_REF,
} from '../../../r3f/tiledUpload/tiledSheet.testkit';

const HFRAMES = 4;

function spriteAt(frame: number) {
  const heading = { type: 'node', attributes: { type: 'Sprite3D', name: 'S' } };
  const properties = parseSprite3D(heading, { texture: SHEET_REF, hframes: String(HFRAMES), frame: String(frame) });
  return <Sprite3D node={{ name: 'S', type: 'Sprite3D', children: [], properties }} />;
}

describe('Sprite3D over a sheet that uploads in bands', () => {
  it('draws the sheet while its frame changes every frame', async () => {
    const sprite = await mountSheetSprite(spriteAt);
    for (let frameIndex = 1; frameIndex <= SHEET_BANDS; frameIndex += 1) {
      await sprite.tick();
      await sprite.showFrame(frameIndex % HFRAMES);
    }
    await sprite.tick();

    const map = sprite.drawnMap();
    expect(map).not.toBeNull();
    expect(sprite.gpu.storageOf(map!)?.writesPerRow.every((writes) => writes === 1)).toBe(true);
  });

  it('copies each row of the sheet once across frame changes', async () => {
    const sprite = await mountSheetSprite(spriteAt);
    for (let frameIndex = 1; frameIndex <= SHEET_BANDS * 2; frameIndex += 1) {
      await sprite.tick();
      await sprite.showFrame(frameIndex % HFRAMES);
    }

    expect(sprite.gpu.rowsCopied()).toBe(SHEET_HEIGHT);
  });

  it('shows the new frame\'s window over the uploaded sheet, with no copy', async () => {
    const sprite = await mountSheetSprite(spriteAt);
    for (let band = 0; band < SHEET_BANDS; band += 1) await sprite.tick();
    await sprite.showFrame(2);
    await sprite.tick();

    const map = sprite.drawnMap();
    expect(map?.offset.x).toBeCloseTo(2 / HFRAMES, 6);
    expect(map?.repeat.x).toBeCloseTo(1 / HFRAMES, 6);
    expect(sprite.gpu.rowsCopied()).toBe(SHEET_HEIGHT);
  });
});
