# HTML report format

The architecture review is one self-contained HTML file in the OS temp directory. Tailwind and Mermaid come from CDNs. Mermaid draws graph-shaped diagrams. Hand-built divs and inline SVG draw the editorial visuals (mass diagrams, cross-sections). Mix the two: Mermaid for everything looks generic.

## Scaffold

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Architecture review: {{repo name}}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      mermaid.initialize({ startOnLoad: true, theme: "neutral", securityLevel: "loose" });
    </script>
    <style>
      /* What Tailwind does not cover: dashed seam lines, leak strokes, the deep-module fill. */
      .seam { stroke-dasharray: 4 4; }
      .leak { stroke: #dc2626; }
      .deep { background: linear-gradient(135deg, #0f172a, #1e293b); }
    </style>
  </head>
  <body class="bg-stone-50 text-slate-900 font-sans">
    <main class="max-w-5xl mx-auto px-6 py-12 space-y-12">
      <header>...</header>
      <section id="candidates" class="space-y-10">...</section>
      <section id="top-recommendation">...</section>
    </main>
  </body>
</html>
```

## Header

The repo name, the date and a compact legend: solid box = module, dashed line = seam, red arrow = leakage, thick dark box = deep module. No introduction paragraph: the candidates follow at once.

## Candidate card

The diagrams carry the content. The prose is sparse and plain, and uses the glossary terms ([LANGUAGE.md](LANGUAGE.md)).

Each candidate is one `<article>`:

- **Title**: short, names the deepening (for example "Collapse the Order intake pipeline").
- **Badge row**: the recommendation strength (`Strong` = emerald, `Worth exploring` = amber, `Speculative` = slate), and a tag for the dependency category (`in-process`, `local-substitutable`, `ports & adapters`, `mock`).
- **Files**: a monospaced list, `font-mono text-sm`.
- **Before / After diagram**: the centrepiece. Two columns, side by side. See the patterns below.
- **Problem**: one sentence. What hurts.
- **Solution**: one sentence. What changes.
- **Wins**: bullets of at most 6 words each, for example "Tests hit one interface", "Pricing logic stops leaking", "Delete 4 shallow wrappers".
- **ADR callout** (if it applies): one line in an amber box.

No paragraphs of explanation. If a diagram needs a paragraph, redraw the diagram.

## Diagram patterns

Pick the pattern that fits the candidate, and vary them across the report.

### Mermaid graph (dependencies and call flow)

Use a Mermaid `flowchart` or `graph` when the point is "X calls Y calls Z, and it is a mess". Wrap it in a Tailwind card. Use `classDef` to colour leakage edges red and the deep module dark. A sequence diagram suits "before: 6 round-trips; after: 1".

```html
<div class="rounded-lg border border-slate-200 bg-white p-4">
  <pre class="mermaid">
    flowchart LR
      A[OrderHandler] --> B[OrderValidator]
      B --> C[OrderRepo]
      C -.leak.-> D[PricingClient]
      classDef leak stroke:#dc2626,stroke-width:2px;
      class C,D leak
  </pre>
</div>
```

### Hand-built boxes and arrows (when Mermaid's layout does not fit)

Modules are `<div>`s with borders and labels. Arrows are inline SVG `<line>` or `<path>` elements, positioned absolutely over a relative container. Use this when the "after" diagram must show one thick-bordered deep module with greyed-out internals, which Mermaid cannot draw with the right weight.

### Cross-section (layered shallowness)

Stack horizontal bands (`h-12 border-l-4`) for the layers a call passes through. Before: 6 thin layers that each do nothing. After: 1 thick band labelled with the combined responsibility.

### Mass diagram (an interface as wide as its implementation)

Two rectangles per module: one for the interface surface, one for the implementation. Before: the interface rectangle is nearly as tall as the implementation rectangle (shallow). After: the interface rectangle is short and the implementation rectangle is tall (deep).

### Call-graph collapse

Before: a tree of function calls as nested boxes. After: the same tree collapsed into one box, with the internal calls faded inside it.

## Style

- Editorial, not a corporate dashboard. Generous whitespace. A serif for headings is optional (`font-serif` suits stone and slate).
- Use colour sparingly: one accent (emerald or indigo), red for leakage and amber for warnings.
- Keep diagrams about 320px tall, so before and after fit side by side without scrolling.
- Use `text-xs uppercase tracking-wider` for module labels inside diagrams, so they read as a schematic, not as UI.
- The only scripts are the Tailwind CDN and the Mermaid ESM import. The report is otherwise static: no app code and no interactivity beyond Mermaid's rendering.

## Top recommendation section

One larger card: the candidate name, one sentence on why, and an anchor link to its card.

## Tone

Plain and concise English, with the architectural nouns and verbs from [LANGUAGE.md](LANGUAGE.md).

**Use exactly:** module, interface, implementation, depth, deep, shallow, seam, adapter, leverage, locality.

**Never substitute:** component, service, unit (for module) · API, signature (for interface) · boundary (for seam) · layer, wrapper (for module, when you mean module).

**Phrasings in this style:**

- "Order intake module is shallow: interface nearly matches the implementation."
- "Pricing leaks across the seam."
- "Deepen: one interface, one place to test."
- "Two adapters justify the seam: HTTP in prod, in-memory in tests."

**Wins bullets** name the gain in glossary terms: *"locality: bugs concentrate in one module"*, *"leverage: one interface, N call sites"*, *"interface shrinks; implementation absorbs the wrappers"*. Do not write *"easier to maintain"* or *"cleaner code"*: those terms are not in the glossary.

No hedging and no filler such as "it is worth noting that…". If a sentence can be a bullet, make it a bullet. If a bullet can go, cut it. If a term is not in [LANGUAGE.md](LANGUAGE.md), find one that is before you invent one.
