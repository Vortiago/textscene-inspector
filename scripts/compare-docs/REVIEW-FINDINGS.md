# Comparison gallery: open review findings

This file lists the open findings from the owner's full-gallery review. To close
one, read both images, the code and the fixture, and decide whether the cause is
a bug, the fixture, the capture or expected behaviour. Then fix it and delete
its entry.

## Gallery and tooling

- **Nav sub-categories.** Under 2D and 3D, split **Visual** from **Other**, so
  the nav is 2D-Visual, 2D-Other, 3D-Visual and 3D-Other.
- **Capture gated overlays on, on both sides.** Capture an overlay that is off by
  default (a navmesh overlay, collision shapes, a selection gizmo) with it shown,
  on both renderers, so the sheet shows how each indicates it. The capture needs
  per-fixture options (toggle or select) on our side. On the Godot side, it needs
  the runtime debug equivalent where one exists (navigation or collision debug).
  A pure editor-only gizmo may have no Godot runtime form, and the investigation
  says which. Camera3D's frustum, CollisionShape3D's outline and
  NavigationRegion3D's navmesh need this.

## Nodes

- **AnimatedSprite2D**: the position agrees with Godot, but the capture does not
  read as animated. Show several frames, or capture a GIF.

## Expected, no fix

- **DirectionalLight3D**: the shadow is cast, but it is occluded from the
  default camera.
- **PathFollow2D**: the `progress_ratio` divergence is real and intended.

## Fixture rules

- A PathFollow3D `progress_ratio` is a no-op at instantiation, so a fixture
  places the follower visibly with a script or a transform.
- An `anchors_preset` without `layout_mode = 1` is inert, so a fixture that
  anchors a PanelContainer uses explicit anchors.
