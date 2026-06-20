# SceneResources stays two explicit mounts, not one ambient shell mount

- Status: Accepted (2026-06-03)
- Related: ADR-0003 (2D-UI DOM overlay), the `SceneResourcesContext` / `useSceneResources` seam.
- Records a pass-3 architecture-review candidate ("lift SceneResourcesProvider to one authoritative
  shell mount") that was investigated and **declined**, so future reviews don't re-suggest it.

## Context

`SceneResourcesProvider` supplies a scene's SubResources + ExtResources to node/control components via
`useSceneResources`. It is currently mounted in two places, each at the boundary of one viewport:

- **3D:** inside `TscnSceneContents` (which runs inside the R3F `<Canvas>`), deriving the root scene's
  resources from `HierarchyContext`.
- **2D:** inside `ControlOverlay`, which takes `internalResources` / `externalResources` as **explicit
  props** (defaulted to `[]`), passed down by `ViewportArea`.

A nested `SceneResourcesProvider` in `NodeDispatcher` additionally overrides the resources for a
PackedScene-instanced subtree — this is load-bearing for instancing and is unrelated to the top-level
mounts.

A review candidate proposed collapsing the two top-level mounts into a single
`SceneResourcesProvider` at the shell level (alongside `HierarchyProvider`), since React context
provably crosses the `<Canvas>` reconciler boundary in this setup (the single shell-level
`HierarchyProvider` is read inside the Canvas with no bridge).

## Decision

Keep the two explicit mounts. Do **not** lift to a single ambient shell-level provider.

The only duplication removed by lifting is the *root-scene → its resources* derivation (~2 lines, done
once per viewport). Against that, lifting would convert `ControlOverlay`'s **clean, explicit
resource-props interface into a hidden ambient-context dependency**: `ControlOverlay` is today a
self-contained, independently-testable unit (both overlay test suites render it with explicit
resources), and every caller/test would instead have to remember to wrap it in a
`SceneResourcesProvider`. The change also sits on the core 3D resource-resolution path and would have
to compose correctly with the nested instancing override across the R3F boundary — non-trivial risk for
a marginal gain.

By the deletion test the candidate **moves** complexity (explicit props → ambient mount) more than it
**concentrates** it. The current shape is the "shallowness is correct" case: two small, explicit
providers at the right boundaries beat one ambient mount with an implicit dependency.

## Consequences

- `ControlOverlay` keeps its explicit `internalResources` / `externalResources` props and stays
  trivially testable in isolation.
- The root-scene → resources derivation remains duplicated in `TscnSceneContents` and `ViewportArea`.
  This is accepted; it is two lines, and each lives next to the viewport it serves.
- Future architecture passes should treat the two-mount layout as intentional, not as accidental
  duplication to be unified.

## Amendment (2026-06-19): a third explicit mount

The 2D-workspace work (ADR-0006, 2026-06-11 amendment) added a **third** explicit top-level mount:
`World2DCanvas` (the 2D R3F world layer inside `Canvas2DStage`) wraps its CanvasItem content in its
own `SceneResourcesProvider`, fed explicit props by `ViewportArea` — alongside the 3D
`TscnSceneContents` mount and the 2D-DOM `ControlOverlay` mount. The decision is unchanged: still
explicit providers at each viewport boundary, **not** one ambient shell-level mount; there are now
three, not two. (The nested `SceneResourcesProvider` in `NodeDispatcher` for PackedScene-instanced
subtrees remains separate and load-bearing, as before.)
