/**
 * 2D-overlay verification GATE (ADR-0024). The visual-golden harness is
 * WebGL-canvas only, so nothing else can see a DOM-overlay regression; happy-dom
 * unit tests can assert a Control is in the DOM but never that it is laid out.
 * This is the only check that answers "did the overlay actually render it". For each 2D-UI fixture: open it via
 * the ?fixture= deep-link (loads in 3D), click the ViewportToolbar "2D" button to
 * mount the Control overlay, then screenshot + report objective stats (rendered
 * control count, unregistered-fallback count, distinct types, console errors).
 *
 * Screenshots land in docs/showcase/verify/<name>-2d.png for human + agent review;
 * the JSON stats go to stdout. Requires the preview server at SHOWCASE_URL.
 *
 *   node scripts/showcase/verify-2d.mjs
 */

/* global document, getComputedStyle, window */ // the page.evaluate callbacks below run in the browser

import { launchShowcaseBrowser } from './browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// Gitignored by default: the gate runs often, and overwriting the committed
// showcase captures would drop binary diffs into unrelated changes. Point
// VERIFY_OUT at docs/showcase/verify to refresh those deliberately.
const OUT = process.env.VERIFY_OUT || 'scripts/showcase/output';
const BASE = process.env.SHOWCASE_URL || 'http://localhost:4173';
// Bundled Chromium unless told otherwise: this is a gate, and the repo's
// determinism contract is the lockfile-pinned browser, never system Chrome.
// Set here rather than as a script env prefix, which cmd.exe cannot parse.
process.env.SHOWCASE_CHANNEL = process.env.SHOWCASE_CHANNEL || 'bundled';

/**
 * [screenshot-name, fixture file, expectations].
 *
 * `expect` turns a target from a report into a gate. `minControls` guards the
 * failure this exists to catch — a subtree silently disappearing — and
 * `types` names the ones whose absence would otherwise look like a smaller
 * number. `maxFallbacks` defaults to 0 — a TextureRect that cannot resolve its
 * texture draws a dashed placeholder, which for a fixture that DOES declare one
 * means a broken resource scope; raise it only where a fixture deliberately
 * leaves a TextureRect textureless. Console errors are never allowed.
 */
const TARGETS = [
  // Its `Icon` TextureRect declares no `texture` at all (a layout placeholder in
  // the mockup), so one dashed fallback is the correct render, not a defect.
  ['ui-dialog', 'example-ui-dialog.tscn', { minControls: 5, maxFallbacks: 1 }],
  ['control-containers', 'unit-control-containers.tscn', { minControls: 5 }],
  ['bbcode', 'unit-rich-text-label.tscn', { minControls: 1 }],
  // Controls living inside instanced sub-scenes, nested two deep behind a
  // Node3D root — the shape every real Godot HUD uses.
  [
    'control-instanced-hud',
    'unit-control-instanced-hud.tscn',
    { minControls: 5, types: ['Label', 'TextureRect'], texts: ['HUD LAYER', 'BADGE'] },
  ],
  // A Control parented to each of the five Control types that used to render
  // only `node` and drop the `children` ControlDispatcher handed them. Every
  // other 2D fixture nests under containers, which forward children, so the
  // loss was invisible: the five UNDER * strings are what proves it.
  // Checked/unchecked/radio indicators, and three Control types whose own
  // `display` default used to overwrite a hidden node's `display: none`.
  [
    'control-state',
    'unit-control-state.tscn',
    {
      minControls: 8,
      types: ['CheckBox', 'OptionButton', 'Button', 'GridContainer'],
      texts: ['VISIBLE DROPDOWN'],
      hiddenNodes: ['HiddenDropdown', 'HiddenButton', 'HiddenGrid'],
      indicators: [
        ['checked', 'check', 1],
        ['unchecked', 'check', 1],
        ['checked', 'radio', 1],
        ['unchecked', 'radio', 1],
      ],
    },
  ],
  // modulate (opacity + tint filter), the Control transform, FILL-beats-SHRINK
  // size-flag precedence, TextureRect's expand_mode minimum, and Button.icon.
  [
    'control-transform-modulate',
    'unit-control-transform-modulate.tscn',
    {
      minControls: 9,
      types: ['Label', 'TextureRect', 'Button', 'HBoxContainer', 'CenterContainer'],
      loadedIcons: 1,
      computed: [
        ['FadedLabel', 'opacity', (v) => Math.abs(Number(v) - 0.4) < 0.01, '0.4'],
        ['TintedLabel', 'filter', (v) => v !== 'none', 'a colour-multiply filter'],
        ['PlainLabel', 'filter', (v) => v === 'none', 'no filter'],
        ['RotatedIcon', 'transform', (v) => v !== 'none', 'a rotation matrix'],
        ['MirroredLabel', 'transform', (v) => v.includes('-1'), 'a mirrored matrix'],
        // FILL|SHRINK_CENTER must STRETCH; SHRINK_CENTER alone must centre.
        ['FillCentreLabel', 'alignSelf', (v) => v === 'stretch', 'stretch'],
        ['ShrinkCentreLabel', 'alignSelf', (v) => v === 'center', 'center'],
        // EXPAND_KEEP_SIZE floors the control at the texture's own size.
        ['LogoInContainer', 'width', (v) => v > 0, 'a non-zero width'],
        ['LogoInContainer', 'height', (v) => v > 0, 'a non-zero height'],
      ],
    },
  ],
  [
    'control-nested-children',
    'unit-control-nested-children.tscn',
    {
      minControls: 11,
      types: ['Label', 'CheckBox', 'OptionButton', 'TextureRect', 'RichTextLabel'],
      texts: [
        'UNDER LABEL',
        'UNDER CHECKBOX',
        'UNDER OPTION',
        'UNDER TEXTURE',
        'UNDER RICHTEXT',
      ],
    },
  ],
  /**
   * A sub-viewport holding 2D-WORLD content: the only target whose pixels have
   * to travel through `readPixels` → `<canvas>`, since a Control subtree
   * renders as DOM and would look right with no blit at all. Nothing else in
   * the repo can see this — the golden gate screenshots the WebGL canvas, and
   * this canvas lives in the DOM overlay (ADR-0024).
   *
   * Every value below is a Godot 4.6.3 render of the same fixture:
   *
   *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-2d-content.tscn \
   *     --probe 200,100 --probe 130,160 --probe 280,210
   *   → rgb(127, 127, 127) · rgb(255, 102, 0) · rgb(76, 76, 76)
   *
   * (probes there are stage coordinates: the surface's own top-left is the
   * container's, at 100, 80.)
   */
  [
    'sub-viewport-2d-content',
    'unit-sub-viewport-container-2d-content.tscn',
    {
      minControls: 3,
      types: ['SubViewportContainer', 'ColorRect'],
      surface: {
        node: 'SubViewport',
        size: [200, 150],
        probes: [
          // The encode: stored 55, displayed 128. A raw blit reads 55 here and
          // still looks like a plausible grey — this is the assertion that
          // separates "the pixels arrived" from "the pixels arrived correct".
          [100, 20, [128, 128, 128], 'Band, authored Color(0.5, 0.5, 0.5)'],
          [30, 80, [255, 102, 0], 'Mark'],
          [180, 130, [77, 77, 77], 'uncovered — the viewport clear colour'],
          // Orientation. The readback is bottom-up and `ImageData` is top-down,
          // so a missing (or doubled) row flip lands the Band at rows 110..149
          // and the Mark at columns 150..189. Both must read clear.
          [100, 130, [77, 77, 77], 'below the Band — where a vertical flip puts it'],
          [170, 80, [77, 77, 77], 'right of the Mark — where a horizontal flip puts it'],
        ],
      },
    },
  ],
  /**
   * The same surface fed by the 3D pass instead of the 2D one — the sibling
   * that localises WHICH PASS filled the target. The two fixtures author the
   * same `Color(0.5, 0.5, 0.5)`, so a curve applied to one pass and not the
   * other shows up as a bare value difference between two otherwise identical
   * scenes. It is the pair that caught the 2D canvas tonemapping.
   *
   *   pnpm ref:godot scenes/fixtures/unit-sub-viewport-container-3d-content.tscn \
   *     --probe 200,120 --probe 280,210
   *   → rgb(127, 127, 127) · rgb(76, 76, 76)
   */
  [
    'sub-viewport-3d-content',
    'unit-sub-viewport-container-3d-content.tscn',
    {
      minControls: 3,
      types: ['SubViewportContainer', 'ColorRect'],
      surface: {
        node: 'SubViewport',
        size: [200, 150],
        probes: [
          // The unshaded box: the SAME number the 2D sibling's band reads.
          [100, 40, [128, 128, 128], 'the unshaded box, authored Color(0.5, 0.5, 0.5)'],
          [180, 130, [77, 77, 77], 'uncovered — the viewport clear colour'],
          [100, 130, [77, 77, 77], 'below the box — where a vertical flip puts it'],
          [20, 40, [77, 77, 77], 'left of the box — the camera frames it centred'],
        ],
      },
    },
  ],
  /**
   * SplitContainer solves for ONE number and derives both rects from it, so
   * the gate is the resulting BOX WIDTHS — the thing happy-dom cannot see and
   * the WebGL golden gate does not draw. Every expectation is a Godot 4.6.3
   * render of the same fixture, scanned for the colour edge:
   *
   *   pnpm ref:godot scenes/fixtures/unit-split-container.tscn
   *   Both 194|12|194  Offset 254|12|134  Ratio 294|12|94  FirstOnly 388|12|0
   *   Neither 120|12|268  SepZero 196|8|196  Collapsed 194|12|194  DragColl 200|0|200
   */
  [
    'split-container',
    'unit-split-container.tscn',
    {
      minControls: 9,
      types: ['HSplitContainer', 'ColorRect'],
      computed: [
        ['BothLeft', 'width', (v) => v === 194, '194'],
        ['BothRight', 'width', (v) => v === 194, '194'],
        ['OffsetLeft', 'width', (v) => v === 254, '254'],
        ['OffsetRight', 'width', (v) => v === 134, '134'],
        ['RatioLeft', 'width', (v) => v === 294, '294'],
        ['RatioRight', 'width', (v) => v === 94, '94'],
        ['FirstOnlyLeft', 'width', (v) => v === 388, '388'],
        ['NeitherLeft', 'width', (v) => v === 120, '120'],
        ['NeitherRight', 'width', (v) => v === 268, '268'],
        // The grabber's 8 px floor under an overridden separation.
        ['SepZeroLeft', 'width', (v) => v === 196, '196'],
        // `collapsed` reads split_offset as 0, so this matches Both.
        ['CollapsedLeft', 'width', (v) => v === 194, '194'],
        // HIDDEN_COLLAPSED is the only dragger state that removes the gap.
        ['DraggerCollapsedLeft', 'width', (v) => v === 200, '200'],
        ['DraggerCollapsedRight', 'width', (v) => v === 200, '200'],
      ],
    },
  ],
  /**
   * The same solve on the other axis. A transposed implementation passes the
   * horizontal fixture and fails here, because these children expand
   * VERTICALLY: reading the horizontal flags takes the "neither expands"
   * branch and pins the boundary at split_offset.
   *
   *   Both 144|12|144   Offset 194|12|94
   */
  [
    'split-container-vertical',
    'unit-split-container-vertical.tscn',
    {
      minControls: 5,
      types: ['VSplitContainer', 'ColorRect'],
      computed: [
        ['BothTop', 'height', (v) => v === 144, '144'],
        ['BothBottom', 'height', (v) => v === 144, '144'],
        ['OffsetTop', 'height', (v) => v === 194, '194'],
        ['OffsetBottom', 'height', (v) => v === 94, '94'],
      ],
    },
  ],
];

/** Godot quantises before the sRGB curve; the 8-bit linear target quantises after. */
const PROBE_TOLERANCE = 2;

mkdirSync(OUT, { recursive: true });

const browser = await launchShowcaseBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
// Zoom 1, so a reported box is in the same units Godot's render is.
// `getBoundingClientRect` reports POST-transform pixels, and the 2D stage
// opens fitted — every measurement here was silently scaled by the fit factor,
// which is invisible while the only assertions are "> 0".
// (`FIT_ON_OPEN_2D_STORAGE_KEY` in r3f/components/Canvas2DStage/viewport2d.ts.)
await ctx.addInitScript(() => window.localStorage.setItem('tsi.fitOnOpen2D', 'false'));

const results = [];
for (const [name, file, expect = {}] of TARGETS) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${BASE}/?fixture=${encodeURIComponent(file)}`, { waitUntil: 'load' });
  // Scene loads in 3D first (canvas present); tolerate absence.
  try {
    await page.waitForSelector('canvas', { timeout: 20000 });
  } catch {
    /* some pure-UI scenes may frame fast; continue */
  }

  const btn2d = page.getByRole('button', { name: '2D' });
  let switched = false;
  if ((await btn2d.count()) > 0) {
    await btn2d.first().click();
    switched = true;
  }

  let overlay = false;
  try {
    await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 });
    overlay = true;
  } catch {
    /* overlay never mounted — captured as a failure below */
  }
  await page.waitForTimeout(900); // image load (TextureRect) + layout settle

  // The surface blit samples on a bounded schedule (BLIT_ATTEMPTS × 350 ms in
  // viewportBlit.ts), so a target that needed a late resource has to be given
  // that long before its canvas is read.
  if (expect.surface) await page.waitForTimeout(6000);

  const surface = expect.surface
    ? await page.evaluate((wanted) => {
        const el = document.querySelector(
          `[data-viewport-surface][data-node-name="${wanted.node}"]`
        );
        if (!el) return { reason: `no viewport surface named "${wanted.node}"` };
        const canvas = el.querySelector('[data-viewport-pixels]');
        if (!canvas) return { reason: 'the surface published no pixel canvas' };
        const context = canvas.getContext('2d');
        if (!context) return { reason: 'the pixel canvas has no 2D context' };
        return {
          reason: null,
          size: [canvas.width, canvas.height],
          samples: wanted.probes.map(([x, y]) => [
            ...context.getImageData(x, y, 1, 1).data,
          ].slice(0, 3)),
        };
      }, expect.surface)
    : null;

  const stats = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-control-type]')];
    return {
      controls: all.length,
      fallbacks: document.querySelectorAll('[data-control-fallback="true"]').length,
      types: [...new Set(all.map((e) => e.getAttribute('data-control-type')))].sort(),
      // Every rendered string, for assertions. `textSample` below is the
      // truncated human-readable version for the report — never assert on it,
      // a required string can fall outside the slice.
      texts: all.map((e) => e.textContent?.trim() ?? '').filter((t) => t.length > 0),
      // Node names the browser actually LAYS OUT. Text can't answer "is this
      // hidden": a visible container's textContent still includes a
      // `display: none` child's string. Per-node box presence can — which is
      // the OptionButton/Button/GridContainer bug this gate now guards.
      laidOutNodes: all
        .filter((e) => e.getClientRects().length > 0)
        .map((e) => e.getAttribute('data-node-name'))
        .filter((n) => n),
      // CheckBox draws its state as an indicator glyph; without one a checked
      // and an unchecked box are indistinguishable on screen.
      checkIndicators: [...document.querySelectorAll('[data-check-indicator]')].map((e) => ({
        state: e.getAttribute('data-check-indicator'),
        style: e.getAttribute('data-check-style'),
      })),
      // Computed CSS for named nodes: the only way to see modulate (opacity /
      // filter), the Control transform, cross-axis size flags, and a
      // TextureRect's expand_mode minimum — none of which change textContent.
      computed: Object.fromEntries(
        all
          .filter((e) => e.getAttribute('data-node-name'))
          .map((e) => {
            const cs = getComputedStyle(e);
            const box = e.getBoundingClientRect();
            return [
              e.getAttribute('data-node-name'),
              {
                opacity: cs.opacity,
                filter: cs.filter,
                transform: cs.transform,
                alignSelf: cs.alignSelf,
                width: Math.round(box.width),
                height: Math.round(box.height),
              },
            ];
          })
      ),
      icons: [...document.querySelectorAll('[data-button-icon]')].map((e) =>
        e.getAttribute('data-button-icon')
      ),
      textSample: all
        .filter((e) => e.textContent && e.textContent.trim().length)
        .slice(0, 6)
        .map((e) => e.textContent.trim().slice(0, 40)),
    };
  });

  await page.screenshot({ path: join(OUT, `${name}-2d.png`) });

  const failures = [];
  if (!overlay) failures.push('overlay never mounted');
  if (stats.controls < (expect.minControls ?? 1)) {
    failures.push(`controls ${stats.controls} < expected ${expect.minControls ?? 1}`);
  }
  for (const name of expect.hiddenNodes ?? []) {
    if (stats.laidOutNodes.includes(name)) {
      failures.push(`node "${name}" has visible = false but is still laid out`);
    }
  }
  for (const [name, prop, predicate, label] of expect.computed ?? []) {
    const value = stats.computed[name]?.[prop];
    if (value === undefined) failures.push(`node "${name}" not rendered (no ${prop})`);
    else if (!predicate(value)) failures.push(`${name}.${prop} = ${value} — expected ${label}`);
  }
  if (expect.loadedIcons !== undefined) {
    const loaded = stats.icons.filter((i) => i === 'loaded').length;
    if (loaded !== expect.loadedIcons) {
      failures.push(`expected ${expect.loadedIcons} loaded button icon(s), found ${loaded}`);
    }
  }
  for (const [state, style, count] of expect.indicators ?? []) {
    const found = stats.checkIndicators.filter(
      (i) => i.state === state && i.style === style
    ).length;
    if (found !== count) {
      failures.push(`expected ${count} ${state} ${style} indicator(s), found ${found}`);
    }
  }
  for (const type of expect.types ?? []) {
    if (!stats.types.includes(type)) failures.push(`missing control type ${type}`);
  }
  for (const text of expect.texts ?? []) {
    if (!stats.texts.some((t) => t.includes(text))) failures.push(`missing text "${text}"`);
  }
  const maxFallbacks = expect.maxFallbacks ?? 0;
  if (stats.fallbacks > maxFallbacks) {
    failures.push(`${stats.fallbacks} unresolved-texture fallback(s) > allowed ${maxFallbacks}`);
  }
  if (expect.surface) {
    if (!surface || surface.reason) {
      failures.push(`surface: ${surface?.reason ?? 'not read'}`);
    } else {
      const [w, h] = expect.surface.size;
      if (surface.size[0] !== w || surface.size[1] !== h) {
        failures.push(
          `surface canvas is ${surface.size.join('x')}, expected ${w}x${h} (the target's size)`
        );
      }
      expect.surface.probes.forEach(([x, y, wantRgb, label], i) => {
        const got = surface.samples[i];
        if (got.some((c, ch) => Math.abs(c - wantRgb[ch]) > PROBE_TOLERANCE)) {
          failures.push(
            `surface (${x}, ${y}) [${label}] is rgb(${got.join(', ')}), ` +
              `expected rgb(${wantRgb.join(', ')}) ±${PROBE_TOLERANCE}`
          );
        }
      });
    }
  }
  if (errors.length > 0) failures.push(`${errors.length} console error(s)`);

  results.push({
    name,
    file,
    switched,
    overlay,
    ...stats,
    ...(surface ? { surface } : {}),
    failures,
    errors: errors.slice(0, 5),
  });
  console.log(
    `${failures.length ? '✗' : '✓'} ${name}: overlay=${overlay} controls=${stats.controls} ` +
      `fallbacks=${stats.fallbacks} types=[${stats.types.join(',')}] errors=${errors.length}` +
      (failures.length ? `\n    ${failures.join('\n    ')}` : '')
  );
  await page.close();
}

await ctx.close();
await browser.close();
writeFileSync(join(OUT, 'verify-2d.json'), JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.length} screenshots + verify-2d.json to ${OUT}`);

const failed = results.filter((r) => r.failures.length > 0);
if (failed.length > 0) {
  console.error(`\n[verify-2d] ${failed.length}/${results.length} target(s) failed:`);
  for (const r of failed) console.error(`  ${r.name}: ${r.failures.join('; ')}`);
  process.exit(1);
}
console.log(`[verify-2d] PASS: ${results.length}/${results.length} targets.`);
