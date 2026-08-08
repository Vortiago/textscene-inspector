/**
 * The committed demo, rasterised: a real Control subtree with an ExtResource
 * image and a sub-viewport whose Controls the on-screen overlay never draws.
 *
 * It is the second half of suite C and runs on the SAME page, so the publisher
 * suite calls it rather than opening its own.
 */

/* global document, getComputedStyle */ // the page.evaluate callbacks run in the browser

import { GODOT_CLEAR_RGB } from './godotColours.mjs';
import { installHarness } from './pixelHarness.mjs';

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

export async function checkDemoRaster(page, { base, moduleSource, check, report }) {
  // The committed demo: a real Control subtree, with an ExtResource image and a
  // sub-viewport whose Controls the on-screen overlay never draws.
  let demoLoaded = true;
  try {
    await page.goto(`${base}/?fixture=${encodeURIComponent(DEMO_FIXTURE)}`, {
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
}
