# The y-sort reads the poses a mixer writes

- Status: Accepted
- Related: ADR-0011, ADR-0016, `r3f/useLiveYSort.ts`, `r3f/ySortLiveItems.ts`,
  `r3f/contexts/AnimatedValueContext.tsx`.

## Context

Godot sorts a y-sorted item's children on their transforms at draw time
(`renderer_canvas_cull.cpp:110-170`), so a child that an AnimationPlayer moves across a tile row
changes its place in the draw order on the frame it crosses.

The collection pass (`ySortItems.ts`) sorts on the authored pose and the poses of the live scene
passes. A mixer writes a clip's transform straight onto the THREE group of the node (ADR-0011), and
the collection pass never sees it. Before this decision a child that crossed a row kept its place
until the scene was rebuilt.

## Decision

- A driver calls `useAnnounceMixerPose` after its mixer moves objects: on each playing frame, each
  seek and each stop. The announcement is one key of the AnimatedValue registry (ADR-0016), so it
  needs no second provider and no second transform path.
- `useLiveYSort` listens to the announcement. It reads the sort y of each node item from the
  groups that draw it, folds the lifted ancestors in, and renders again only when the sorted order
  changes. A frame where no y moved costs one read of each group, about 1 µs for each item.
- `<YSortDispatcher>` renders its items in collection order and gives each its place through its
  paint range. A reorder of the elements makes R3F apply the authored props to the moved group
  again, which undoes the pose the mixer wrote that frame. A paused seek writes the pose once, so
  nothing would restore it.

## Consequences

- A tile row sorts on the authored pose of its layer. No mixer moves a lifted layer: the layer has
  no registered group that a track path can name.
- A node that an announcement cannot read, such as a Node3D or one that is not mounted, keeps the
  sort y of the collection pass.
