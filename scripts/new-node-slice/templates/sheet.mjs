/**
 * The comparison sheet a slice ships with (SHEET-STANDARD.md). Its category is
 * a guess; its status, `visual:` and `renders_as` are NOT — they follow from
 * the intent, and `sheets.test.mjs` asserts the status against the render
 * registration in both directions, so they cannot be hand-edited apart from the
 * slice without failing.
 */

export function sheetFile({ typeName, baseKey, intent, fixtureName, imageBasename }) {
  // The comparison sheet is slice content (SHEET-STANDARD.md). `image:` ships
  // commented out: a declared-but-uncaptured basename fails build-gallery (and
  // so the web build), while recapture only collects sheets that DO declare one.
  // So the order is: uncomment the line, then `pnpm recapture --only <basename>`.
  // Until then the gallery shows its "not captured yet" placeholder.
  //
  // `category` is a best guess — 2D/3D from the type suffix, Other for a
  // non-visual node; the corpus is genuinely mixed here (AnimationPlayer is 3D,
  // Timer is Other), so check the nav divider it lands under.
  const sheetCategory = /2D$/.test(typeName)
    ? '2D'
    : /3D$/.test(typeName)
      ? '3D'
      : baseKey === 'node2d' || baseKey === 'control'
        ? '2D'
        : baseKey === 'node'
          ? 'Other'
          : '3D';

  // Status and `visual:` follow from the intent, and `sheets.test.mjs` asserts
  // the status against the render registration in both directions — so these
  // cannot be hand-edited apart from the slice without failing.
  const sheetStatus = { draws: 'unreviewed', 'transform-only': 'linter-only', pending: 'unimplemented' }[
    intent
  ];
  // A node that draws nothing has no image pair worth showing. A `pending` node
  // has none YET, and will once it renders, so it does not claim `visual: false`.
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
