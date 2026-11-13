/**
 * The scope cuts of the repository's documents that name no owner, each with the reason it may stay.
 * `documents.test.mjs` fails on a cut that is not here, and on an entry no document holds any more,
 * so the table only shrinks. `pnpm pr:state` does not read it: a change that adds or rewrites the
 * first line of a cut gives the cut its owner.
 */

/** ADR-0003 keeps why the DOM was chosen. ADR-0037 replaced its decision and its limits. */
const SUPERSEDED_BY_ADR_0037 = 'a superseded record: ADR-0037 replaced the decision';

/** The sentence tells what an earlier ADR put off, and this ADR then does that work. */
const TELLS_WHAT_THIS_ADR_DOES = 'tells what ADR-0011 put off, which this ADR does';

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
    path: 'docs/adr/0016-frame-tracks-via-push-registry.md',
    startsWith: 'A Godot `value` track that targets `Sprite2D:frame`',
    reason: TELLS_WHAT_THIS_ADR_DOES,
  },
  {
    path: 'docs/adr/0016-frame-tracks-via-push-registry.md',
    startsWith: 'This is the scoped form of the value push that ADR-0011 deferred',
    reason: TELLS_WHAT_THIS_ADR_DOES,
  },
];

/**
 * Whether the table holds the unowned cut that starts with `text` in the document at `path`.
 *
 * @param {{ path: string, text: string }} cut
 */
export function isKnownUnownedCut({ path, text }) {
  return KNOWN_UNOWNED_CUTS.some((known) => known.path === path && text.startsWith(known.startsWith));
}
