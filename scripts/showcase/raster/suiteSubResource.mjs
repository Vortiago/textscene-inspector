/**
 * Suite A — the sub-resource contract, on a self-contained fixture.
 *
 * It pins the browser behaviour the rasteriser exists to work around: Chrome
 * renders SVG-as-image with sub-resource loading disabled, so a `blob:` image
 * inside a foreignObject draws NOTHING while the same bitmap as a `data:` URL
 * draws in full. Also covers the Godot default clear colour, supersampling, and
 * the null guards.
 */

/* global document */ // the page.evaluate callbacks run in the browser

import { GODOT_CLEAR_RGB } from './godotColours.mjs';
import { installHarness } from './pixelHarness.mjs';

export async function runSubResourceSuite(ctx, { fixtureUrl, moduleSource, check, report }) {
  console.log('\n[A] sub-resource contract');
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  await page.goto(fixtureUrl, { waitUntil: 'load' });
  await installHarness(page, moduleSource);

  const stats = await page.evaluate(async (clearRgb) => {
    // A magenta 32x32 PNG behind a blob: URL — what an image loader natively
    // produces before anything converts it to a data URL.
    const bitmap = document.createElement('canvas');
    bitmap.width = bitmap.height = 32;
    const bctx = bitmap.getContext('2d');
    bctx.fillStyle = 'rgb(255,0,255)';
    bctx.fillRect(0, 0, 32, 32);
    const blobUrl = await new Promise((res) =>
      bitmap.toBlob((b) => res(URL.createObjectURL(b)), 'image/png')
    );
    const dataUrl = bitmap.toDataURL('image/png');

    const subtree = document.getElementById('subtree');
    const img = document.getElementById('blob-img');
    const bg = document.getElementById('blob-bg');
    const magenta = [255, 0, 255];

    const measure = async (src, rasterise) => {
      img.src = src;
      await img.decode();
      bg.style.backgroundImage = `url("${src}")`;
      const canvas = await rasterise(subtree);
      if (!canvas) return { failed: true };
      const p = globalThis.__pixels(canvas);
      return { magenta: p.matching(magenta, 40), opaque: p.opaque(), size: [p.width, p.height] };
    };

    const out = {
      blobNaive: await measure(blobUrl, globalThis.__rasteriseNaive),
      blobFixed: await measure(blobUrl, (el) => globalThis.__raster.rasterizeControlSubtree(el)),
      dataNaive: await measure(dataUrl, globalThis.__rasteriseNaive),
    };

    // The Godot clear colour, painted under a subtree that is otherwise
    // transparent: proves `backgroundColor` reaches the pixels unmodified.
    const cleared = await globalThis.__raster.rasterizeControlSubtree(subtree, {
      backgroundColor: `rgb(${clearRgb.join(', ')})`,
    });
    const cp = globalThis.__pixels(cleared);
    out.clear = { exact: cp.matching(clearRgb, 0), total: cp.total, opaque: cp.opaque() };

    // Supersampling: backing pixels scale, CSS geometry does not.
    const hi = await globalThis.__raster.rasterizeControlSubtree(subtree, { pixelRatio: 3 });
    out.pixelRatio3 = [hi.width, hi.height];

    // Reusing a canvas is how a caller keeps one THREE.CanvasTexture alive.
    const reused = document.createElement('canvas');
    const returned = await globalThis.__raster.rasterizeControlSubtree(subtree, { canvas: reused });
    out.canvasReused = returned === reused;

    // How an off-screen host may hide itself. Inlining computed style carries
    // every presentational property onto the clone root, and only position,
    // margin and size are overridden — so most ways of hiding the host also
    // hide the raster, and do it by returning a BLANK canvas rather than null.
    // Measured here because it is a contract the wiring caller has to obey.
    const hidden = {};
    for (const [name, property, value] of [
      ['offscreen', 'left', '-99999px'],
      ['visibility', 'visibility', 'hidden'],
      ['opacity', 'opacity', '0'],
      ['clipPath', 'clipPath', 'inset(100%)'],
    ]) {
      subtree.style.setProperty(property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`), value);
      const canvas = await globalThis.__raster.rasterizeControlSubtree(subtree);
      hidden[name] = canvas === null ? null : globalThis.__pixels(canvas).opaque();
      subtree.style.removeProperty(property.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`));
    }
    out.hostHiding = hidden;

    // Guards, in the browser this time — real layout, so "no layout" here means
    // a genuinely zero-sized box rather than happy-dom's blanket zeros.
    out.guards = {
      nullElement: (await globalThis.__raster.rasterizeControlSubtree(null)) === null,
      zeroSize:
        (await globalThis.__raster.rasterizeControlSubtree(document.getElementById('empty'))) ===
        null,
      detached:
        (await globalThis.__raster.rasterizeControlSubtree(document.createElement('div'))) === null,
      displayNone: await (async () => {
        subtree.style.display = 'none';
        const r = await globalThis.__raster.rasterizeControlSubtree(subtree);
        subtree.style.display = '';
        return r === null;
      })(),
    };
    return out;
  }, GODOT_CLEAR_RGB);

  report.subResourceContract = stats;

  // 48x48 CSS px of image in each of two elements = 4608 px at full coverage.
  const FULL = 48 * 48 * 2;
  check(
    'blob: image draws NOTHING through a plain foreignObject',
    stats.blobNaive.magenta === 0,
    `${stats.blobNaive.magenta} magenta px (this is the gap the module closes)`
  );
  check(
    'rasterizeControlSubtree recovers the blob: image in full',
    stats.blobFixed.magenta >= FULL * 0.98,
    `${stats.blobFixed.magenta}/${FULL} magenta px`
  );
  check(
    'data: image needs no rescue (it was never the failure)',
    stats.dataNaive.magenta >= FULL * 0.98,
    `${stats.dataNaive.magenta}/${FULL} magenta px through the plain foreignObject`
  );
  check(
    `backgroundColor paints Godot's default clear colour exactly`,
    stats.clear.exact > stats.clear.total * 0.5,
    `${stats.clear.exact}/${stats.clear.total} px are exactly rgb(${GODOT_CLEAR_RGB.join(',')})`
  );
  check(
    'pixelRatio supersamples the backing store',
    stats.pixelRatio3[0] === 720 && stats.pixelRatio3[1] === 480,
    `240x160 CSS px at pixelRatio 3 → ${stats.pixelRatio3.join('x')} backing px`
  );
  check('options.canvas is drawn into and returned', stats.canvasReused === true);
  check(
    'an OFF-SCREEN host still rasterises its content',
    stats.hostHiding.offscreen > 1000,
    `${stats.hostHiding.offscreen} opaque px at left:-99999px`
  );
  check(
    'visibility/opacity/clip-path on the host blank the raster (documented contract)',
    stats.hostHiding.visibility === 0 &&
      stats.hostHiding.opacity === 0 &&
      stats.hostHiding.clipPath === 0,
    `visibility=${stats.hostHiding.visibility} opacity=${stats.hostHiding.opacity} ` +
      `clip-path=${stats.hostHiding.clipPath} opaque px — hide the host by moving it off-screen`
  );
  check('null element → null', stats.guards.nullElement === true);
  check('zero-size element → null', stats.guards.zeroSize === true);
  check('detached element → null', stats.guards.detached === true);
  check('display:none element → null', stats.guards.displayNone === true);
  check('no page errors', consoleErrors.length === 0, `${consoleErrors.length}`);
  await page.close();
}
