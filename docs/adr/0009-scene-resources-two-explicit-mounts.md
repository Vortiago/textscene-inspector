# SceneResources stays two explicit mounts, not one ambient shell mount

- Status: Accepted
- Related: ADR-0003 (2D-UI DOM overlay), the `SceneResourcesContext` / `useSceneResources` seam.

## Context

`SceneResourcesProvider` supplies the SubResources and ExtResources of a scene to node and control
components through `useSceneResources`. Each top-level mount sits at the boundary of one viewport:

- **3D:** inside `TscnSceneContents` (which runs inside the R3F `<Canvas>`), deriving the resources of
  the root scene from `HierarchyContext`.
- **2D:** inside `ControlOverlay`, which takes `internalResources` / `externalResources` as **explicit
  props** (default `[]`), passed down by `ViewportArea`.

A nested `SceneResourcesProvider` in `NodeDispatcher` also overrides the resources for a
PackedScene-instanced subtree. That one is load-bearing for instancing and is unrelated to the
top-level mounts.

React context crosses the `<Canvas>` reconciler boundary in this setup: the single shell-level
`HierarchyProvider` is read inside the Canvas with no bridge. So a single shell-level
`SceneResourcesProvider` beside `HierarchyProvider` is possible.

## Decision

Keep the explicit mounts. Do **not** lift them to a single ambient shell-level provider.

A lift removes only the derivation from root scene to resources (about two lines, once per
viewport). Against that, it turns the **clean, explicit resource-props interface of `ControlOverlay`
into a hidden ambient-context dependency**. `ControlOverlay` is a self-contained unit that tests alone
(both overlay test suites render it with explicit resources). With a lift, every caller and test must
remember to wrap it in a `SceneResourcesProvider`. The lift also sits on the core 3D
resource-resolution path and must compose with the nested instancing override across the R3F
boundary: real risk for a marginal gain.

By the deletion test the lift **moves** complexity (explicit props to an ambient mount) more than it
**concentrates** it. This is the "shallowness is correct" case: small, explicit providers at the right
boundaries beat one ambient mount with an implicit dependency.

## Consequences

- `ControlOverlay` keeps its explicit `internalResources` / `externalResources` props and stays
  testable in isolation.
- The derivation from root scene to resources stays duplicated in `TscnSceneContents` and
  `ViewportArea`. It is two lines, and each lives next to the viewport it serves.
- Treat the explicit-mount layout as intentional, not as duplication to unify.

## Amendment: a third explicit mount

The 2D workspace (ADR-0006, workspace-parity amendment) adds a **third** explicit top-level mount.
`World2DCanvas` (the 2D R3F world layer inside `Canvas2DStage`) wraps its CanvasItem content in its
own `SceneResourcesProvider`, fed explicit props by `ViewportArea`. It sits beside the 3D
`TscnSceneContents` mount and the 2D-DOM `ControlOverlay` mount. The decision is unchanged: explicit
providers at each viewport boundary, **not** one ambient shell-level mount. The nested
`SceneResourcesProvider` in `NodeDispatcher` for PackedScene-instanced subtrees stays separate and
load-bearing.
