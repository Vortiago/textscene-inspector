/** The default face loader answers a face FreeType cannot open before it asks the browser. */
import { describe, expect, it } from 'vitest';
import { loadSceneFontMetrics } from './sceneFontLoad';
import { UNOPENED_FACE } from './settledFonts';
import { fixtureFontBytes } from './sfntOutlines.testkit';

describe('loadSceneFontMetrics of bytes FreeType cannot open', () => {
  it('answers the unopened face for a font cut short before its tables', async () => {
    const truncated = fixtureFontBytes('montserrat-semibold-subset.ttf').slice(0, 4000);

    expect(await loadSceneFontMetrics(truncated, 'Label')).toBe(UNOPENED_FACE);
  });

  it('asks the browser for a font FreeType opens, which happy-dom cannot load (error path)', async () => {
    expect(
      await loadSceneFontMetrics(fixtureFontBytes('montserrat-semibold-subset.ttf'), 'Label')
    ).toBeNull();
  });
});
