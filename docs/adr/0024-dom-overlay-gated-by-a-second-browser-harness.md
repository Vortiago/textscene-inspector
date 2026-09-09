# DOM-overlay regressions are gated by a second browser harness, not by the visual goldens

- Status: Accepted (2026-07-19). **Superseded by ADR-0037 (2026-08-04):** its premise
  — that the visual goldens are WebGL-canvas-only and happy-dom has no layout, so
  nothing else could see a DOM-overlay regression — no longer applies once Controls
  are renderer pixels. Native Controls join the visual-golden set behind the existing
  `mode: '2d'` parity capture; `verify-2d.mjs` and `pnpm verify:2d` are deleted with
  the DOM overlay they existed to cover. Kept for the record: the split-by-what's-
  measured reasoning under Consequences, below, is why a THIRD gate (`verify:raster`)
  existed at all, and that one retires the same way, for the same reason.
- Related: ADR-0003 (2D-UI DOM overlay, superseded), ADR-0006 (viewport-mode seam),
  the `scripts/visual/` golden harness and `scripts/showcase/verify-2d.mjs`.

## Context

The **Control overlay** is HTML/CSS (ADR-0003), and the visual-golden harness deliberately
excludes it. `scripts/visual/scenes.mjs` states the policy outright: *"WebGL-canvas-rendered
scenes only — no 2D DOM overlays, so the captured image depends on nothing but the renderer."*

That left the overlay with no regression guard at all. It surfaced when the overlay was found
to render nothing for Controls living inside an instanced sub-scene. It walked the static
**SceneGraph**, where an instance is a childless node, instead of the **Live scene tree**. The
whole 2D UI of a scene composed the normal Godot way, by instancing, was invisible, and no
gate could see it. Unit tests could not close the gap either. Web tests run under happy-dom,
which has no CSS cascade or layout, so they can assert that a Control is in the DOM but never
that it is laid out or visible.

## Decision

Gate DOM-overlay behaviour with a **second, browser-based harness**, `verify-2d.mjs`,
rather than extending the visual goldens to screenshot the DOM. It is promoted from a
diagnostic script to a real gate: per-target expectations, non-zero exit, `pnpm verify:2d`,
run in CI.

It asserts **objective DOM stats** per fixture, not pixels: rendered control count, required
control types, zero unregistered fallbacks, zero console errors.

## Considered options

**Relax the golden policy to include DOM-overlay screenshots.** Rejected. It would put fonts,
the CSS cascade and text layout inside images whose determinism contract is "depends on
nothing but the renderer" (bundled chromium plus SwiftShader). One overlay scene would be
bought at the cost of every existing baseline's stability, and DOM text rendering is exactly
the kind of thing that differs across hosts.

**Unit tests only.** Rejected as the sole guard. happy-dom cannot answer "is it visible", which
is the question a UI regression actually poses.

## Consequences

- Browser harnesses exist on purpose, and there are three. The split is by *what is being
  measured*, not by accident: pixels from the renderer (goldens), DOM facts from the overlay
  (verify-2d), and pixels of a raster *derived* from the overlay (verify-raster). The third is
  the `rasterizeControlSubtree` gate added by ADR-0003's 2026-07-29 amendment. The third needs a
  real browser for the same reason this ADR does: happy-dom has neither layout nor a rasteriser.
- The gate needs a preview server, so it is slower than `test:unit` and cannot run in-process.
- Assertions are counts and types, so they catch "the subtree vanished" but not "it moved 10px".
  That is the intended trade. The failure this exists to catch is silent disappearance.
