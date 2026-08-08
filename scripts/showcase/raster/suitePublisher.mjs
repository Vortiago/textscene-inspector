/**
 * Suite C — the Control-raster PUBLISHER, end to end onto a 3D surface.
 *
 * The whole chain: the off-screen host a Control-only `SubViewport` mounts, the
 * raster it publishes, and the pixels that reach the 3D quad consuming it as a
 * `ViewportTexture` (ADR-0030). Its two colour assertions are Godot 4.6.3's own
 * numbers for the same scene, so this is where the colour pipeline — one tonemap
 * application, on the surface, never on the raster — is pinned.
 */

/* global document, getComputedStyle */ // the page.evaluate callbacks run in the browser

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PNG } from 'pngjs';
import { checkDemoRaster } from './suiteDemo.mjs';

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

export async function runPublisherSuite(ctx, { base, out, moduleSource, check, report }) {
  console.log('\n[C] Control-raster publisher');
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));

  let loaded = true;
  try {
    await page.goto(`${base}/?fixture=${encodeURIComponent(PUBLISHER_FIXTURE)}`, {
      waitUntil: 'load',
      timeout: 20000,
    });
  } catch (e) {
    loaded = false;
    check(`preview server reachable at ${base}`, false, e.message.split('\n')[0]);
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
      writeFileSync(join(out, 'raster-viewport-texture.png'), shot);
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

  await checkDemoRaster(page, { base, moduleSource, check, report });
  await page.close();
}
