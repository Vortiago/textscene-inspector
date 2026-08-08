/**
 * Suite B — the real ControlOverlay, through the preview server.
 *
 * The actual overlay for a fixture, loaded exactly as `verify-2d.mjs` loads it,
 * then rasterised. This is the one that can catch "the module is fine but the
 * real subtree rasterises blank".
 */

/* global document */ // the page.evaluate callbacks run in the browser

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GODOT_CLEAR_RGB, GODOT_FONT_RGB } from './godotColours.mjs';
import { installHarness } from './pixelHarness.mjs';

/**
 * `unit-control-transform-modulate.tscn`: the 2D fixture with the most raster
 * surface — three Labels in the default font colour, two TextureRects and a
 * Button icon, all on `textures/checkerboard.svg` (pure #ffffff / #000000
 * squares, so image pixels are separable from text at a brightness threshold).
 * `verify-2d.mjs` already gates that its images resolve (`loadedIcons: 1`), so
 * a blank raster here is the rasteriser's fault, not the overlay's.
 */
const OVERLAY_FIXTURE = 'unit-control-transform-modulate.tscn';

export async function runOverlaySuite(ctx, { base, out, moduleSource, check, report }) {
  console.log('\n[B] real ControlOverlay');
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  let loaded = true;
  try {
    await page.goto(`${base}/?fixture=${encodeURIComponent(OVERLAY_FIXTURE)}`, {
      waitUntil: 'load',
      timeout: 20000,
    });
  } catch (e) {
    loaded = false;
    check(
      `preview server reachable at ${base}`,
      false,
      `${e.message.split('\n')[0]} — run \`pnpm preview:test\` (or set SHOWCASE_URL)`
    );
  }

  if (loaded) {
    // Same load sequence as verify-2d.mjs: 3D first, toolbar toggle to 2D,
    // then let TextureRect images decode.
    try {
      await page.waitForSelector('canvas', { timeout: 20000 });
    } catch {
      /* pure-UI scenes may frame before the canvas appears */
    }
    const btn2d = page.getByRole('button', { name: '2D' });
    if ((await btn2d.count()) > 0) await btn2d.first().click();
    let overlay = true;
    try {
      await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 });
    } catch {
      overlay = false;
    }
    check('Control overlay mounted', overlay);
    await page.waitForTimeout(900);

    await installHarness(page, moduleSource);

    const stats = await page.evaluate(
      async ([fontRgb, clearRgb]) => {
        const root = document.querySelector('[data-control-overlay="true"]');
        if (!root) return { missing: true };

        // What the overlay actually hands the rasteriser, so the report can say
        // whether ADR-0003's data:-URL promise held on this path.
        const imgSrcs = [...root.querySelectorAll('img')].map((i) => ({
          scheme: (i.getAttribute('src') || '').slice(0, 5),
          decoded: i.complete && i.naturalWidth > 0,
        }));

        const canvas = await globalThis.__raster.rasterizeControlSubtree(root, {
          backgroundColor: `rgb(${clearRgb.join(', ')})`,
        });
        if (!canvas) return { missing: false, canvas: null, imgSrcs };

        let tainted = false;
        let p;
        try {
          p = globalThis.__pixels(canvas);
        } catch {
          tainted = true;
        }
        const result = {
          imgSrcs,
          controls: root.querySelectorAll('[data-control-type]').length,
          rootSize: [root.offsetWidth, root.offsetHeight],
          canvasSize: [canvas.width, canvas.height],
          tainted,
          dataUrl: canvas.toDataURL('image/png'),
        };
        if (!tainted) {
          result.opaque = p.opaque();
          result.total = p.total;
          result.clearPixels = p.matching(clearRgb, 0);
          result.textPixels = p.matching(fontRgb, 6);
          result.imageWhitePixels = p.brighterThan(246);
          result.distinctColours = p.distinctColours();
        }
        return result;
      },
      [GODOT_FONT_RGB, GODOT_CLEAR_RGB]
    );

    if (stats.missing) {
      check('overlay root found', false, 'no [data-control-overlay="true"]');
    } else if (!stats.canvas && stats.opaque === undefined && stats.tainted === undefined) {
      check('overlay rasterised', false, 'rasterizeControlSubtree returned null');
    } else {
      const { dataUrl, ...loggable } = stats;
      report.realOverlay = loggable;
      writeFileSync(join(out, 'raster-control-overlay.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

      check(
        'canvas matches the overlay box',
        stats.canvasSize[0] === stats.rootSize[0] && stats.canvasSize[1] === stats.rootSize[1],
        `overlay ${stats.rootSize.join('x')} → canvas ${stats.canvasSize.join('x')}`
      );
      check('canvas is NOT tainted (readable by WebGL)', stats.tainted === false);
      check(
        'raster is fully painted',
        stats.opaque === stats.total,
        `${stats.opaque}/${stats.total} px opaque`
      );
      check(
        'Control content covers the clear colour',
        stats.total - stats.clearPixels > 5000,
        `${stats.total - stats.clearPixels} non-backdrop px of ${stats.controls} controls`
      );
      check(
        'Label text shaped and rasterised',
        stats.textPixels > 200,
        `${stats.textPixels} px at the default_theme font colour rgb(${GODOT_FONT_RGB.join(',')})`
      );
      check(
        'TextureRect / Button-icon images rasterised',
        stats.imageWhitePixels > 500,
        `${stats.imageWhitePixels} px of checkerboard #ffffff`
      );
      check(
        'raster is not a flat fill',
        stats.distinctColours > 8,
        `${stats.distinctColours} distinct opaque colours`
      );
      check(
        'every overlay <img> carries a self-contained source',
        stats.imgSrcs.length > 0 && stats.imgSrcs.every((i) => i.scheme === 'data:'),
        stats.imgSrcs.map((i) => `${i.scheme}${i.decoded ? '' : '(undecoded)'}`).join(' ') || 'none'
      );
    }
    check('no page errors', consoleErrors.length === 0, `${consoleErrors.length}`);
  }
  await page.close();
}
