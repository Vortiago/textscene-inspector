# ADR 0023 — Preview panels are pinned per document; no follow-the-active-editor mode

- Status: Accepted (2026-07-12)

Each **Preview panel** is keyed to one `.tscn` document and never retargets when a
different file gains editor focus — the opposite of the Markdown previewer's default
follow mode. Big scenes take real time to parse, load resources for, and render;
a follow mode would tear down and rebuild that work on every editor focus change,
turning file browsing into render churn. Pinned panels keep each scene's loaded
state (resources, camera, selection) alive for its whole session, and per-document
keying gives side-by-side parent + sub-scene previews for free.

The freshness this forgoes is covered by the refresh contracts instead: the panel's
own scene follows **Save-driven refresh** (ADR-0021), and every file the panel ever
resolved — transitively, at any depth — flows through **Dependency hot-reload**,
delivered even to hidden panels (their webviews stay live), so a backgrounded panel
is already current when re-focused. If a follow mode is ever revisited, it must not
reload the scene on focus change — it would need panel reuse with cached scene
state, not retargeting.
