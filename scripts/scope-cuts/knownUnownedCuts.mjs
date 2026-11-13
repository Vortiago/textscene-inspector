/**
 * The scope cuts of the repository's documents that name no owner, each with the reason it may stay.
 * `documents.test.mjs` fails on a cut that is not here, and on an entry no document holds any more,
 * so the table only shrinks.
 */

/** ADR-0003 keeps why the DOM was chosen. ADR-0037 replaced its decision and its limits. */
const SUPERSEDED_BY_ADR_0037 = 'a superseded record: ADR-0037 replaced the decision';

/** The sentence tells what an earlier ADR put off, and this ADR then does that work. */
const TELLS_WHAT_THIS_ADR_DOES = 'tells what ADR-0011 put off, which this ADR does';

/** The scope audit of 2026-11-13 found no issue for the cut. Its owner search is not done. */
const NO_OWNER_FOUND_YET = 'no owner found by the scope audit of 2026-11-13';

/**
 * @typedef {object} KnownCut
 * @property {string} path - from the repository root.
 * @property {string} startsWith - how the first line of the cut starts.
 * @property {string} reason
 */

/** @type {KnownCut[]} */
export const KNOWN_UNOWNED_CUTS = [
  {
    path: 'docs/adr/0003-2d-ui-dom-overlay.md',
    startsWith: '- Tree-to-element highlight works.',
    reason: SUPERSEDED_BY_ADR_0037,
  },
  {
    path: 'docs/adr/0003-2d-ui-dom-overlay.md',
    startsWith: '- **Recursive `ViewportTexture` is out of scope',
    reason: SUPERSEDED_BY_ADR_0037,
  },
  {
    path: 'docs/adr/0004-csg-as-primitive.md',
    startsWith: 'Scope is the three trivial CSG primitives.',
    reason: 'done since: each CSG type it names has a slice under `nodes/3d/csg/`',
  },
  {
    path: 'docs/adr/0006-viewport-mode-seam.md',
    startsWith: 'Out of scope: viewport picking inside the 2D world canvas.',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0008-invisible-render-intent.md',
    startsWith: '- The 3D view does not signal an unsupported node type.',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0011-animationplayer-drives-siblings-via-mixer.md',
    startsWith: '- The slice supports `value` tracks',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0015-animatedsprite2d-is-a-transport-driver.md',
    startsWith: '- The scrubber is **time-based**',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0016-frame-tracks-via-push-registry.md',
    startsWith: 'A Godot `value` track that targets `Sprite2D:frame`',
    reason: TELLS_WHAT_THIS_ADR_DOES,
  },
  {
    path: 'docs/adr/0016-frame-tracks-via-push-registry.md',
    startsWith: 'This is the scoped form of the value push that ADR-0011 deferred',
    reason: TELLS_WHAT_THIS_ADR_DOES,
  },
  {
    path: 'docs/adr/0017-continuous-value-tracks-via-interpolating-push-sampler.md',
    startsWith: '- **Cubic interpolation and keyframe `transition` easing',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0019-animationtree-drives-via-driver-registry.md',
    startsWith: '- **Full per-bone Blend2 `filter`s',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0020-web-source-pane.md',
    startsWith: '4. **Linter surfaced as a gutter and popover.**',
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0035-control-setter-order-gets-a-warning-not-yet-a-parser-fix.md',
    startsWith: "`nodes/2d/ui/shared/range.ts`'s `resolveRangeValue` does the same",
    reason: NO_OWNER_FOUND_YET,
  },
  {
    path: 'docs/adr/0037-control-nodes-render-natively-in-the-canvas.md',
    startsWith: '- Non-goals: interactivity',
    reason: NO_OWNER_FOUND_YET,
  },
];
