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
 *  C. `Control-raster publisher` — the whole chain: the off-screen host a
 *     Control-only `SubViewport` mounts, the raster it publishes, and the
 *     pixels that reach the 3D quad consuming it as a `ViewportTexture`
 *     (ADR-0030). Its two colour assertions are Godot 4.6.3's own numbers for
 *     the same scene, so this is where the colour pipeline — one tonemap
 *     application, on the surface, never on the raster — is pinned.
 *
 * Requires the preview server at SHOWCASE_URL for suites B and C (as
 * `pnpm verify:2d` does), and `pnpm --filter @textscene/core build` for the
 * injected module.
 *
 *   pnpm verify:raster
 */

/* global document, getComputedStyle, Image, XMLSerializer */ // page.evaluate callbacks run in the browser

import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
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

// ---------------------------------------------------------------------------
// Suite C — the Control-raster PUBLISHER, end to end onto a 3D surface
// ---------------------------------------------------------------------------

/**
 * `unit-sub-viewport-control-texture.tscn`: a Control-only SubViewport behind a
 * `ViewportTexture` on an unshaded quad, with a flat Color(0.5, 0.5, 0.5)
 * ColorRect and a default-theme Panel over it.
 *
 * Both values below are Godot 4.6.3's, measured on this exact scene, and they
 * are what makes this suite a PARITY gate rather than a smoke test. Godot draws
 * a viewport's canvas AFTER that viewport's tonemap pass
 * (`RendererViewport::_draw_viewport` runs `_draw_3d`, which ends in
 * `_render_buffers_post_process_and_tonemap`, before its `render_canvas` loop),
 * so a Control target stores untonemapped sRGB and the editor preview
 * environment's FILMIC curve applies exactly ONCE — on the quad. A publisher
 * that pre-tonemapped its raster would land the backdrop near rgb(196) and the
 * panel near rgb(107); a publisher that tagged the texture LINEAR instead of
 * sRGB would miss the decode and be brighter still.
 */
const PUBLISHER_FIXTURE = 'unit-sub-viewport-control-texture.tscn';
/** Godot: the Color(0.5, 0.5, 0.5) backdrop, through one FILMIC application. */
const GODOT_QUAD_BACKDROP_RGB = [162, 162, 162];
/** Godot: `style_normal_color` Color(0.1, 0.1, 0.1, 0.6) composited over it. */
const GODOT_QUAD_PANEL_RGB = [84, 84, 84];
/** The committed demo this whole path exists for. */
const DEMO_FIXTURE = 'demos/viewport/gui_in_3d/gui_panel_3d.tscn';
/**
 * The demo's project sets `gui/theme/default_theme_scale=2.0`
 * (`scenes/demos/viewport/gui_in_3d/project.godot:27`), and Godot builds its
 * default theme from that — `scene/theme/default_theme.cpp`,
 * `fill_default_theme`:
 *
 *     theme->set_default_font_size(Math::round(default_font_size * scale));
 *
 * so round(16 · 2.0) = 32. It is the ONLY project in the corpus that sets the
 * key, which is what makes this scene the one place the setting is observable.
 * The un-scaled 16 is what the previewer rendered before it read the file at
 * all — text visibly smaller than Godot's, at a size no scene had asked for.
 */
const DEMO_THEME_FONT_SIZE = 32;
/**
 * `theme_override_constants/separation = 13` on the demo's VBoxContainer. An
 * override is NOT scaled — Godot returns one exactly as the scene authored it —
 * so this staying 13 while the font doubles is what separates "read the project
 * setting" from "multiplied every px in sight".
 */
const DEMO_VBOX_SEPARATION = 13;

console.log('\n[C] Control-raster publisher');
{
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  let loaded = true;
  try {
    await page.goto(`${BASE}/?fixture=${encodeURIComponent(PUBLISHER_FIXTURE)}`, {
      waitUntil: 'load',
      timeout: 20000,
    });
  } catch (e) {
    loaded = false;
    check(`preview server reachable at ${BASE}`, false, e.message.split('\n')[0]);
  }

  if (loaded) {
    // Stays in 3D: the surface that consumes the target is the quad, and the
    // host is mounted in both modes precisely because it belongs to neither.
    await page.waitForSelector('canvas', { timeout: 20000 }).catch(() => {});
    let mounted = true;
    try {
      await page.waitForSelector('[data-viewport-raster-host]', { timeout: 15000 });
    } catch {
      mounted = false;
    }
    check('off-screen raster host mounted in the 3D workspace', mounted);
    await page.waitForTimeout(1500);

    const host = await page.evaluate(() => {
      const element = document.querySelector('[data-viewport-raster-host]');
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        path: element.getAttribute('data-viewport-raster-host'),
        count: document.querySelectorAll('[data-viewport-raster-host]').length,
        box: [element.offsetWidth, element.offsetHeight],
        left: parseFloat(style.left),
        position: style.position,
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        clipPath: style.clipPath,
        // A registered Control renders its own box; the fallback renders
        // `display: contents` and rasterises as nothing, which is exactly the
        // failure an empty ControlComponentRegistry produces.
        fallbacks: element.querySelectorAll('[data-control-passthrough="true"]').length,
        controls: element.querySelectorAll('[data-control-type]').length,
      };
    });

    if (!host) {
      check('raster host found', false, 'no [data-viewport-raster-host]');
    } else {
      report.publisherHost = host;
      check(
        'one host, keyed by the sub-viewport node path',
        host.count === 1 && host.path === 'Root/SubViewport',
        `${host.count} host(s), path "${host.path}"`
      );
      check(
        'host is sized to SubViewport.size (never to the raster options)',
        host.box[0] === 256 && host.box[1] === 256,
        `${host.box.join('x')} CSS px`
      );
      check(
        'host hides by moving OFF-SCREEN, the only hiding the rasteriser survives',
        host.position === 'fixed' &&
          host.left < -9999 &&
          host.display !== 'none' &&
          host.visibility === 'visible' &&
          host.opacity === '1' &&
          (host.clipPath === 'none' || !host.clipPath),
        `${host.position} left:${host.left} display:${host.display} ` +
          `visibility:${host.visibility} opacity:${host.opacity} clip-path:${host.clipPath}`
      );
      check(
        'Controls resolved to real components, not the passthrough fallback',
        host.controls > 0 && host.fallbacks === 0,
        `${host.controls} controls, ${host.fallbacks} fallbacks ` +
          `(a non-zero count means the Control registry never loaded)`
      );
    }

    // The end of the chain: what the QUAD shows. Screenshotting the canvas
    // element is the only way to read it — the context is not
    // `preserveDrawingBuffer`, so `toDataURL` from the page comes back blank.
    const canvas = page.locator('canvas').first();
    const shot = (await canvas.count()) > 0 ? await canvas.screenshot() : null;
    if (!shot) {
      check('WebGL canvas captured', false, 'no canvas element');
    } else {
      writeFileSync(join(OUT, 'raster-viewport-texture.png'), shot);
      const png = PNG.sync.read(shot);
      const countNear = (rgb, tol) => {
        let n = 0;
        for (let i = 0; i < png.data.length; i += 4) {
          if (
            Math.abs(png.data[i] - rgb[0]) <= tol &&
            Math.abs(png.data[i + 1] - rgb[1]) <= tol &&
            Math.abs(png.data[i + 2] - rgb[2]) <= tol
          )
            n++;
        }
        return n;
      };
      const backdrop = countNear(GODOT_QUAD_BACKDROP_RGB, 2);
      const panel = countNear(GODOT_QUAD_PANEL_RGB, 2);
      report.publisherQuad = { backdrop, panel, size: [png.width, png.height] };
      check(
        `quad shows the raster backdrop at Godot's rgb(${GODOT_QUAD_BACKDROP_RGB.join(',')})`,
        backdrop > 5000,
        `${backdrop} px — a pre-tonemapped raster would sit near rgb(196)`
      );
      check(
        `quad shows the theme Panel at Godot's rgb(${GODOT_QUAD_PANEL_RGB.join(',')})`,
        panel > 1000,
        `${panel} px — pins the StyleBox composite through the same one curve`
      );
    }
    check('no page errors', consoleErrors.length === 0, `${consoleErrors.length}`);
  }

  // The committed demo: a real Control subtree, with an ExtResource image and a
  // sub-viewport whose Controls the on-screen overlay never draws.
  let demoLoaded = true;
  try {
    await page.goto(`${BASE}/?fixture=${encodeURIComponent(DEMO_FIXTURE)}`, {
      waitUntil: 'load',
      timeout: 20000,
    });
  } catch {
    demoLoaded = false;
  }
  if (demoLoaded) {
    await page.waitForSelector('[data-viewport-raster-host]', { timeout: 15000 }).catch(() => {});
    // `project.godot` is fetched after first paint, so the subtree rasterises
    // once at the default theme and again once the scale lands. Waiting on the
    // METRIC rather than on a fixed delay keeps the assertion below from racing
    // that second pass — if the scale never arrives this times out and the
    // check reports the unscaled size, which is the regression it exists for.
    await page
      .waitForFunction(
        (expected) => {
          const label = document.querySelector(
            '[data-viewport-raster-host] [data-control-type="Label"]'
          );
          return !!label && getComputedStyle(label).fontSize === expected;
        },
        `${DEMO_THEME_FONT_SIZE}px`,
        { timeout: 15000 }
      )
      .catch(() => {});
    await page.waitForTimeout(1800);
    await installHarness(page, moduleSource);

    const stats = await page.evaluate(async (clearRgb) => {
      const element = document.querySelector('[data-viewport-raster-host]');
      if (!element) return { missing: true };
      const raster = await globalThis.__raster.rasterizeControlSubtree(element, {
        backgroundColor: `rgb(${clearRgb.join(', ')})`,
      });
      if (!raster) return { missing: false, raster: null };
      const p = globalThis.__pixels(raster);
      return {
        box: [element.offsetWidth, element.offsetHeight],
        canvasSize: [p.width, p.height],
        opaque: p.opaque(),
        total: p.total,
        clearPixels: p.matching(clearRgb, 0),
        distinctColours: p.distinctColours(),
        // Color(1, 0, 0, 1) ColorRect — the one saturated primary in the scene,
        // so it separates "the subtree rasterised" from "the backdrop did".
        redPixels: p.matching([255, 0, 0], 6),
        imgSrcs: [...element.querySelectorAll('img')].map((i) => ({
          scheme: (i.getAttribute('src') || '').slice(0, 5),
          decoded: i.complete && i.naturalWidth > 0,
        })),
        // The project's theme scale, measured where it is actually visible.
        // `lines` is the wrap the scale causes: the Label is 299 px wide, so
        // doubling the font forces a break the un-scaled render never had.
        theme: (() => {
          const label = element.querySelector('[data-control-type="Label"]');
          const box = element.querySelector('[data-control-type="VBoxContainer"]');
          const button = element.querySelector('[data-control-type="Button"]');
          if (!label) return null;
          const range = document.createRange();
          range.selectNodeContents(label);
          return {
            labelFontSize: getComputedStyle(label).fontSize,
            labelLines: range.getClientRects().length,
            vboxGap: box ? getComputedStyle(box).gap : null,
            buttonPadding: button ? getComputedStyle(button).padding : null,
            buttonRadius: button ? getComputedStyle(button).borderRadius : null,
          };
        })(),
      };
    }, GODOT_CLEAR_RGB);

    if (stats.missing) {
      check('demo raster host mounted', false, `no host for ${DEMO_FIXTURE}`);
    } else if (!stats.canvasSize) {
      check('demo host rasterised', false, 'rasterizeControlSubtree returned null');
    } else {
      report.demoRaster = stats;
      check(
        'demo host is the SubViewport size (560x360), and the raster follows it',
        stats.box[0] === 560 &&
          stats.box[1] === 360 &&
          stats.canvasSize[0] === 560 &&
          stats.canvasSize[1] === 360,
        `host ${stats.box.join('x')} → raster ${stats.canvasSize.join('x')}`
      );
      check(
        'demo raster is fully painted',
        stats.opaque === stats.total,
        `${stats.opaque}/${stats.total} px opaque`
      );
      check(
        'demo Control content covers the clear colour',
        stats.total - stats.clearPixels > 20000,
        `${stats.total - stats.clearPixels} non-backdrop px`
      );
      check(
        "demo ColorRect's Color(1, 0, 0, 1) rasterised",
        stats.redPixels > 5000,
        `${stats.redPixels} px of pure red`
      );
      check(
        'demo raster is not a flat fill',
        stats.distinctColours > 8,
        `${stats.distinctColours} distinct opaque colours`
      );
      check(
        'demo TextureRect resolved its sub-scene-scoped ExtResource to a data: URL',
        stats.imgSrcs.length > 0 && stats.imgSrcs.every((i) => i.scheme === 'data:'),
        stats.imgSrcs.map((i) => `${i.scheme}${i.decoded ? '' : '(undecoded)'}`).join(' ') || 'none'
      );
      check(
        `demo honours the project's gui/theme/default_theme_scale=2.0 (font ${DEMO_THEME_FONT_SIZE}px)`,
        stats.theme?.labelFontSize === `${DEMO_THEME_FONT_SIZE}px`,
        `Label font-size ${stats.theme?.labelFontSize ?? 'n/a'}`
      );
      check(
        'demo Label wraps once the theme scale doubles its font',
        (stats.theme?.labelLines ?? 0) > 1,
        `${stats.theme?.labelLines ?? 0} line(s) in a 299 px box`
      );
      check(
        'demo Button chrome scales with the theme (4/3 → 8/6 px)',
        stats.theme?.buttonPadding === '8px' && stats.theme?.buttonRadius === '6px',
        `padding ${stats.theme?.buttonPadding ?? 'n/a'}, radius ${stats.theme?.buttonRadius ?? 'n/a'}`
      );
      check(
        `demo VBoxContainer keeps its separation OVERRIDE unscaled (${DEMO_VBOX_SEPARATION}px)`,
        stats.theme?.vboxGap === `${DEMO_VBOX_SEPARATION}px`,
        `gap ${stats.theme?.vboxGap ?? 'n/a'}`
      );
    }
  } else {
    check(`demo fixture ${DEMO_FIXTURE} reachable`, false);
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
