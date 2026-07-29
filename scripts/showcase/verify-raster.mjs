/**
 * Control-subtree RASTERISER gate (ADR-0003 amendment, ADR-0024's rule).
 *
 * `rasterizeControlSubtree` turns a live Control DOM subtree into a canvas that
 * WebGL can sample — the derived raster a `SubViewport` composited onto a 3D
 * surface via `ViewportTexture` needs. Nothing in vitest can see whether it
 * works: happy-dom has neither layout nor a rasteriser, so it cannot lay a
 * Control out and cannot draw an SVG image. Only a real browser can, which is
 * exactly the situation ADR-0024 created a second harness for.
 *
 * Two suites, both asserting PIXELS:
 *
 *  A. `sub-resource contract` — self-contained, served from a throwaway
 *     `node:http` server, needs no preview build. It pins the browser behaviour
 *     the module exists to work around: Chrome renders SVG-as-image with
 *     sub-resource loading disabled, so a `blob:` image inside a foreignObject
 *     draws NOTHING while the same bitmap as a `data:` URL draws in full. Also
 *     covers the Godot default clear colour, supersampling, and the null guards.
 *
 *  B. `real overlay` — the actual ControlOverlay for a fixture, loaded through
 *     the preview server exactly as `verify-2d.mjs` loads it, then rasterised.
 *     This is the one that can catch "the module is fine but the real subtree
 *     rasterises blank".
 *
 * Requires the preview server at SHOWCASE_URL for suite B (as `pnpm verify:2d`
 * does), and `pnpm --filter @textscene/core build` for the injected module.
 *
 *   pnpm verify:raster
 */

/* global document, getComputedStyle, Image, XMLSerializer */ // page.evaluate callbacks run in the browser

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchShowcaseBrowser } from './browser.mjs';

const BASE = process.env.SHOWCASE_URL || 'http://localhost:4173';
const OUT = process.env.VERIFY_OUT || 'scripts/showcase/output';
// Bundled Chromium unless told otherwise — same determinism contract as the
// other showcase harnesses.
process.env.SHOWCASE_CHANNEL = process.env.SHOWCASE_CHANNEL || 'bundled';

const MODULE_PATH = 'packages/textscene-core/dist/r3f/controls/rasterizeControlSubtree.js';

/**
 * Godot's viewport clear colour behind a Control subtree:
 * `main/main.cpp` — `GLOBAL_DEF_BASIC("rendering/environment/defaults/default_clear_color",
 * Color(0.3, 0.3, 0.3))`, selected by `servers/rendering/renderer_viewport.cpp`
 * (`transparent_bg ? Color(0,0,0,0) : get_default_clear_color()`) and quantised
 * by `Color::to_rgba32()` (`core/math/color.cpp`), which uses
 * `Math::round(0.3 * 255) = 77`.
 */
const GODOT_CLEAR_RGB = [77, 77, 77];

/**
 * `default_theme.cpp` sets `control_font_color` = Color(0.875, …) →
 * round(0.875·255) = 223, which `godotDefaultTheme.ts` mirrors as
 * `DEFAULT_FONT_COLOR = 'rgb(223, 223, 223)'`. Label glyphs land on that value;
 * antialiasing only blends it DOWNWARD toward the backdrop, which is what makes
 * it separable from the checkerboard's #ffffff below.
 */
const GODOT_FONT_RGB = [223, 223, 223];

mkdirSync(OUT, { recursive: true });

if (!existsSync(MODULE_PATH)) {
  console.error(
    `[verify-raster] ${MODULE_PATH} is missing — run \`pnpm --filter @textscene/core build\` first.`
  );
  process.exit(1);
}
const moduleSource = readFileSync(MODULE_PATH, 'utf8');
const failures = [];
const report = {};

/** Record a gate assertion; `detail` is echoed either way so numbers are always visible. */
function check(label, ok, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail === undefined ? '' : ` — ${detail}`}`);
  if (!ok) failures.push(`${label}${detail === undefined ? '' : ` (${detail})`}`);
}

/**
 * Injected into every page: loads the built module off a blob URL (it has zero
 * imports, so it needs no import map) and installs the pixel helpers the
 * assertions below read.
 */
async function installHarness(page, source) {
  await page.evaluate(async (code) => {
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    globalThis.__raster = await import(url);

    /** Every pixel of a canvas, plus counters. Throws if the canvas is tainted. */
    globalThis.__pixels = (canvas) => {
      const ctx = canvas.getContext('2d');
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const near = (i, [r, g, b], tol) =>
        Math.abs(data[i] - r) <= tol &&
        Math.abs(data[i + 1] - g) <= tol &&
        Math.abs(data[i + 2] - b) <= tol;
      return {
        width: canvas.width,
        height: canvas.height,
        total: data.length / 4,
        opaque: () => {
          let n = 0;
          for (let i = 3; i < data.length; i += 4) if (data[i] > 8) n++;
          return n;
        },
        matching: (rgb, tol = 3) => {
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 200 && near(i, rgb, tol)) n++;
          }
          return n;
        },
        brighterThan: (threshold) => {
          let n = 0;
          for (let i = 0; i < data.length; i += 4) {
            if (
              data[i + 3] > 200 &&
              data[i] >= threshold &&
              data[i + 1] >= threshold &&
              data[i + 2] >= threshold
            )
              n++;
          }
          return n;
        },
        distinctColours: () => {
          const seen = new Set();
          for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 200) seen.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
          }
          return seen.size;
        },
      };
    };

    /**
     * The NAIVE rasterisation — clone, inline computed styles, foreignObject —
     * with no image-source inlining. It is the control condition for suite A:
     * whatever it drops is what `rasterizeControlSubtree` has to rescue.
     */
    globalThis.__rasteriseNaive = async (element) => {
      const w = element.offsetWidth;
      const h = element.offsetHeight;
      const clone = element.cloneNode(true);
      const from = [element, ...element.querySelectorAll('*')];
      const to = [clone, ...clone.querySelectorAll('*')];
      for (let i = 0; i < from.length; i++) {
        const cs = getComputedStyle(from[i]);
        let text = '';
        for (let p = 0; p < cs.length; p++) text += `${cs.item(p)}:${cs.getPropertyValue(cs.item(p))};`;
        to[i].setAttribute('style', text);
      }
      clone.style.position = 'relative';
      clone.style.left = '0';
      clone.style.top = '0';
      clone.style.margin = '0';
      const holder = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
      holder.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
      holder.appendChild(clone);
      const markup = new XMLSerializer().serializeToString(holder);
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<foreignObject width="100%" height="100%">${markup}</foreignObject></svg>`;
      const image = new Image();
      const ok = await new Promise((res) => {
        image.onload = () => res(true);
        image.onerror = () => res(false);
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      });
      if (!ok) return null;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(image, 0, 0, w, h);
      return canvas;
    };
  }, source);
}

// ---------------------------------------------------------------------------
// Suite A — sub-resource contract, on a self-contained fixture
// ---------------------------------------------------------------------------

const FIXTURE_HTML = `<!doctype html><meta charset="utf-8"><title>raster fixture</title>
<body style="margin:0;background:#000">
<div id="subtree" style="position:absolute;left:40px;top:24px;width:240px;height:160px;
     font-family:system-ui,sans-serif;font-size:16px;color:rgb(223,223,223)">
  <div id="text" style="position:absolute;left:8px;top:8px">GODOT CONTROL</div>
  <img id="blob-img" style="position:absolute;left:8px;top:40px;width:48px;height:48px">
  <div id="blob-bg" style="position:absolute;left:72px;top:40px;width:48px;height:48px;
       background-repeat:no-repeat;background-size:100% 100%"></div>
</div>
<div id="empty" style="position:absolute;left:0;top:0;width:0;height:0"></div>
</body>`;

const server = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(FIXTURE_HTML);
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const fixtureUrl = `http://127.0.0.1:${server.address().port}/`;

const browser = await launchShowcaseBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

console.log('\n[A] sub-resource contract');
{
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

// ---------------------------------------------------------------------------
// Suite B — the real ControlOverlay, through the preview server
// ---------------------------------------------------------------------------

/**
 * `unit-control-transform-modulate.tscn`: the 2D fixture with the most raster
 * surface — three Labels in the default font colour, two TextureRects and a
 * Button icon, all on `textures/checkerboard.svg` (pure #ffffff / #000000
 * squares, so image pixels are separable from text at a brightness threshold).
 * `verify-2d.mjs` already gates that its images resolve (`loadedIcons: 1`), so
 * a blank raster here is the rasteriser's fault, not the overlay's.
 */
const OVERLAY_FIXTURE = 'unit-control-transform-modulate.tscn';

console.log('\n[B] real ControlOverlay');
{
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  let loaded = true;
  try {
    await page.goto(`${BASE}/?fixture=${encodeURIComponent(OVERLAY_FIXTURE)}`, {
      waitUntil: 'load',
      timeout: 20000,
    });
  } catch (e) {
    loaded = false;
    check(
      `preview server reachable at ${BASE}`,
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
      writeFileSync(join(OUT, 'raster-control-overlay.png'), Buffer.from(dataUrl.split(',')[1], 'base64'));

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

await ctx.close();
await browser.close();
server.close();

writeFileSync(join(OUT, 'verify-raster.json'), JSON.stringify(report, null, 2));
console.log(`\nWrote verify-raster.json + raster-control-overlay.png to ${OUT}`);

if (failures.length > 0) {
  console.error(`\n[verify-raster] FAIL: ${failures.length} assertion(s)`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('[verify-raster] PASS');
