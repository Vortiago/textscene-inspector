# ADR 0023: Preview panels are pinned per document; no follow-the-active-editor mode

- Status: Accepted

Each **Preview panel** is keyed to one `.tscn` document. It does not retarget when a
different file gets editor focus. This is the opposite of the Markdown previewer's
default follow mode. A big scene takes real time to parse, to load resources for and to
render. A follow mode would remove and rebuild that work on each change of editor focus,
so browsing files would become render churn. A pinned panel keeps the scene's loaded
state (resources, camera, selection) for its whole session. Per-document keying also
gives side-by-side previews of a parent scene and its sub-scene.

The refresh contracts give the freshness that pinning gives up. The panel's own scene
follows **Save-driven refresh** (ADR-0021). Each file the panel resolved, transitively
and at any depth, goes through **Dependency hot-reload**. It reaches hidden panels too,
because their webviews stay live, so a panel in the background is current when it gets
focus again. A future follow mode must not reload the scene on a change of focus. It
needs panel reuse with cached scene state, not retargeting.
