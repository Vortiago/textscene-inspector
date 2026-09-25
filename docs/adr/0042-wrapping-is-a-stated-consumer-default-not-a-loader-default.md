# Wrapping is a stated consumer default, not a loader default

- Status: Accepted (2026-09-24).
- Related: ADR-0031 (resource slices — the image loader is the `formats/image`
  slice and the panorama is the `sky` slice; both own their texture's wrapping
  rather than inheriting one). ADR-0037 (Control nodes render natively in the
  canvas — the 2D canvas is the consumer whose clamp this protects).

## Context

The image loader set `wrapS = wrapT = RepeatWrapping` on every decoded texture.
Repeat is Godot's `BaseMaterial3D` default — it constructs with
`FLAG_USE_TEXTURE_REPEAT` set (`scene/resources/material.cpp`) — but three's
`Texture` default is clamp-to-edge. The loader reached past its own job to apply
the 3D default to every image.

That is wrong because one decoded texture is cached once per path and shared by
every consumer of that path. A 3D material wants Repeat. A 2D canvas item wants
clamp: its `texture_repeat` defaults to `TEXTURE_REPEAT_PARENT`, which resolves
at the root to the viewport's
`DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_DISABLED` (`scene/main/viewport.h:420`,
applied at `scene/main/viewport.cpp:4009`). The loader chose Repeat for both, so
the canvas had to undo a decision made somewhere it could not see, and the
undecoded 2D view forced clamp on top of a value the loader had already set.

The deeper problem is the shape of the choice, not its direction. A loader that
writes wrapping is a hidden global: it decides for consumers it has never met,
and a consumer that reads the shared entry's wrapping and trusts it inherits an
answer it never asked for. Mutating a shared cache entry to suit one consumer is
also the bug waiting to happen — a 2D and a 3D consumer of the same path cannot
both own one texture's sampler state.

## Decision

**The loader leaves wrapping at three's clamp-to-edge default and states nothing
about repeat. Each consumer states its own wrapping at bind time.**

Three consumers, three stated answers:

- A 3D material reads `texture_repeat` through `applyTextureState`, which makes
  the wrap divergence bidirectional: default or `true` asks for Repeat, `false`
  asks for clamp. Only a texture already carrying what the binding wants stays
  shared; anything else is a source-shared clone carrying the wanted wrapping.
- The 2D canvas (`useCanvas2DTexture`) keeps clamp, which is what the shared
  entry already carries and what Godot's canvas resolves to.
- The panorama sky samples with `fract(atan(...))`, so u wraps 0..1 and must
  tile. It cannot route through a material, so it builds its own source-shared
  Repeat copy (`skyPanoramaTexture`) and disposes it with the sky environment.
  It never mutates the shared entry.

## Consequences

A default 3D material over a clamped shared entry now clones, where it used to
share. The cost is one extra `Texture` per distinct clamped image a 3D material
binds. The benefit is that the shared entry is never mutated, so the same path
serving a 2D item and a 3D surface gives each its own sampler state instead of
one silently winning over the other.

Wrapping is now visible at every bind site and absent from the loader. There is
no default to discover by reading a file that does not mention the consumer.

Clamp is three's own default, so a hand-built `new THREE.Texture()` now behaves
the way three promises; a test that wants a tiled texture seeds Repeat rather
than relying on the loader to have applied it.

The divergence being bidirectional has one edge worth naming: clamping a texture
that already tiles is now a divergence, so `repeat = false` on a tiled entry
clones. That is the honest cost of the loader no longer being the one that tiled
it in the first place.
