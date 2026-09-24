# DOM-overlay regressions are gated by a second browser harness, not by the visual goldens

- Status: Superseded by ADR-0037. Its premise was that the visual goldens are
  WebGL-canvas-only and happy-dom has no layout, so nothing else can see a DOM-overlay
  regression. That premise fails once Controls are renderer pixels. Native Controls join
  the visual-golden set behind the `mode: '2d'` parity capture, and `verify-2d.mjs` and
  `pnpm verify:2d` go with the DOM overlay. The third gate, `verify:raster`, retires for
  the same reason.
- Related: ADR-0003 (2D-UI DOM overlay, superseded), ADR-0006 (viewport-mode seam),
  the `scripts/visual/` golden harness and `scripts/showcase/verify-2d.mjs`.

## Context

The **Control overlay** is HTML/CSS (ADR-0003), and the visual-golden harness excludes
it on purpose. `scripts/visual/scenes.mjs` states the policy: the goldens hold
WebGL-canvas-rendered scenes only, with no 2D DOM overlays, so the captured image depends
on nothing but the renderer.

So the overlay had no regression guard. For example, the overlay rendered nothing for
Controls inside an instanced sub-scene, because it walked the static **SceneGraph**,
where an instance is a childless node, and not the **Live scene tree**. No gate could
see that. Unit tests cannot close the gap: web tests run under happy-dom, which has no
CSS cascade or layout. They can assert that a Control is in the DOM, but not that it is
laid out or visible.

## Decision

Gate DOM-overlay behaviour with a **second, browser-based harness**, `verify-2d.mjs`,
and do not extend the visual goldens to screenshot the DOM. It is a real gate:
per-target expectations, non-zero exit, `pnpm verify:2d`, run in CI.

It asserts **objective DOM stats** per fixture, not pixels: the rendered control count,
the required control types, zero unregistered fallbacks and zero console errors.

## Considered options

**Relax the golden policy to include DOM-overlay screenshots.** Rejected. It puts fonts,
the CSS cascade and text layout inside images whose determinism contract is "depends on
nothing but the renderer" (bundled chromium plus SwiftShader). One overlay scene would
cost the stability of every existing baseline, and DOM text rendering differs across
hosts.

**Unit tests only.** Rejected as the sole guard. happy-dom cannot answer "is it
visible", which is the question a UI regression asks.

## Consequences

- There are three browser harnesses, split by what each measures: pixels from the
  renderer (goldens), DOM facts from the overlay (verify-2d), and pixels of a raster
  derived from the overlay (verify-raster). The third is the `rasterizeControlSubtree`
  gate from ADR-0003's amendment. It needs a real browser for the same reason as this
  one: happy-dom has neither layout nor a rasteriser.
- The gate needs a preview server, so it is slower than `test:unit` and cannot run
  in-process.
- The assertions are counts and types. They catch "the subtree vanished" but not "it
  moved 10px". That is the intended trade: the failure this catches is silent
  disappearance.
