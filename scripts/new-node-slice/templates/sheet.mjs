/**
 * The comparison sheet a slice ships with (SHEET-STANDARD.md). Its category is a guess. Its status,
 * `visual:` and `renders_as` follow from the intent.
 */

export function sheetFile({ typeName, baseKey, intent, fixtureName, imageBasename }) {
  // `category` guesses 2D or 3D from the type suffix and Other for a non-visual node. The corpus is
  // mixed (AnimationPlayer is 3D, Timer is Other), so check the nav divider it lands under.
  const sheetCategory = /2D$/.test(typeName)
    ? '2D'
    : /3D$/.test(typeName)
      ? '3D'
      : baseKey === 'node2d' || baseKey === 'control'
        ? '2D'
        : baseKey === 'node'
          ? 'Other'
          : '3D';

  // `sheets.test.mjs` asserts the status against the render registration in both directions, so
  // a hand edit apart from the slice fails.
  const sheetStatus = { draws: 'unreviewed', 'transform-only': 'linter-only', pending: 'unimplemented' }[
    intent
  ];
  // A node that draws nothing has no image pair to show. A `pending` node will have one once it
  // renders, so it does not claim `visual: false`.
  const visualLine = intent === 'transform-only' ? 'visual: false\n' : '';
  const rendersAs = {
    draws: 'TBD — one short noun phrase',
    'transform-only': 'nothing (a transform-only group)',
    pending: 'nothing yet — not implemented',
  }[intent];
  const sheetIntro = {
    draws: 'One or two sentences: what the node is, and what the previewer draws for it.',
    'transform-only':
      'This node draws nothing at runtime, so the previewer renders it as a transform-only group (ADR-0008): its children still show, and that absence is the whole story.',
    pending:
      'The previewer parses and validates this node but does not draw it yet, so it renders as an invisible transform-only fallback and its children still show.',
  }[intent];
  // `image:` ships commented out: a declared, uncaptured basename fails build-gallery and so the
  // web build, and recapture collects only declared ones. Uncomment it, then run
  // `pnpm recapture --only <basename>`. Until then the gallery shows a "not captured yet" placeholder.
  return `---
type: ${typeName}
category: ${sheetCategory}
status: ${sheetStatus}
fixture: ${fixtureName}
# image: ${imageBasename}
${visualLine}renders_as: ${rendersAs}
---

# ${typeName}

${sheetIntro}

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |

## Divergences

Not captured yet.

## Linting

<!-- lint:begin ${typeName} -->
<!-- lint:end -->

${typeName} registers no validators or semantic rules of its own yet, so the strict
and lenient parsers agree on every property: whatever \`parser.ts\` reads it reads
without substitution. Replace this once \`linterParser.ts\` has validators, naming
the property and the value the lenient parser falls back to.
`;
}
