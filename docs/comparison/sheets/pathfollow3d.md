---
type: PathFollow3D
category: 3D
fixture: unit-pathfollow-3d.tscn
image: unit-pathfollow-3d
renders_as: a curve-positioned transform group
---

# PathFollow3D

PathFollow3D positions its children along its parent Path3D's curve. The previewer
samples the curve at `progress_ratio` and drives a transform group to that point;
its editor follow-point cross is selection-gated (ADR-0018), so nothing extra shows
in a plain capture — only the child box the follower carries.

## Properties exercised

| Property | Value | Effect |
| --- | --- | --- |
| `progress_ratio` | `0.5` | places the follower at the curve's arc-length midpoint — the corner `(3,0,0)` of the L-shaped path `(0,0,0) → (3,0,0) → (3,0,3)` |

## Divergences

The follower lands in a different place in each image. In ours the 0.6 follower box
sits at the corner `(3,0,0)` — where `progress_ratio` 0.5 falls by arc length — which
the shared editor camera projects off the clipped lower-right edge (~`(997,514)`),
leaving only the small 0.3 box that marks the path origin `(0,0,0)` at frame centre.
Godot's reference shows a single, larger box at frame centre and nothing at the right
edge: its follower is still at the path start `(0,0,0)`, stacked over the origin
marker. The previewer resolves `progress_ratio` 0.5 to the 0.5 arc-length position;
the reference capture shows the follower at the path start, so the ratio's effect is
not visible there.
