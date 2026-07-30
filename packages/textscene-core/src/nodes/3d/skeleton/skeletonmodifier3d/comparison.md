---
type: SkeletonModifier3D
category: 3D
status: linter-only
fixture: unit-skeleton-modifier-3d.tscn
# image: unit-skeleton-modifier-3d
visual: false
renders_as: a transform-only group
---

# SkeletonModifier3D

SkeletonModifier3D is the base class custom skeleton modifiers derive from, feeding a
parent Skeleton3D's bone poses each frame; it draws nothing at runtime, so the previewer
renders it as a transform-only group (ADR-0008) — that absence is the whole story.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `active` | `false` | modifier stops processing — no visible mark |
| `influence` | `0.75` | blends 75% of the modifier's pose into the skeleton — no visible mark |

## Divergences

None visible in this fixture.

## Linting

<!-- lint:begin SkeletonModifier3D -->
Strict parsing format-checks these `SkeletonModifier3D` properties, plus 16 inherited from Node3D. Every validator failure is an **error**.

| Property |
| --- |
| `active` |
| `influence` |

| Rule | Reports | Severity |
| --- | --- | --- |
| `binary-resource-reference` (all nodes) | `binary-resource-reference` | warning |
| `valid-node3d-visibility` (type-family match) | `valid-node3d-visibility` | error, warning |
<!-- lint:end -->

SkeletonModifier3D has no `parser.ts` of its own: it registers `parseNode3D` directly
(index.ts), so `active` and `influence` are never read at all, valid or not — an
out-of-range `influence = 5.0` or a non-boolean `active = "maybe"` is silently dropped
rather than substituted or warned on, consistent with the node rendering as a
transform-only group (ADR-0008).
