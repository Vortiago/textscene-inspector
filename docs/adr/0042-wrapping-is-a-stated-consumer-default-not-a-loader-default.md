# Wrapping is a stated consumer default, not a loader default

- Status: Accepted (2026-09-24).
- Related: ADR-0031 (resource slices: the image loader is the `formats/image`
  slice and the panorama is the `sky` slice, and each owns its texture's
  wrapping rather than inheriting one). ADR-0037 (Control nodes render natively
  in the canvas: the 2D canvas is the consumer whose clamp this protects).

## Context

The image loader set `wrapS = wrapT = RepeatWrapping` on every decoded texture.
Repeat is Godot's `BaseMaterial3D` default, because it constructs with
`FLAG_USE_TEXTURE_REPEAT` set (`scene/resources/material.cpp`). three's
`Texture` default is clamp-to-edge. The loader reached past its own job to apply
the 3D default to every image.

That is wrong because one decoded texture is cached once per path and shared by
every consumer of that path. A 3D material wants Repeat. A 2D canvas item wants
clamp: its `texture_repeat` defaults to `TEXTURE_REPEAT_PARENT`, which resolves
at the root to the viewport's
`DEFAULT_CANVAS_ITEM_TEXTURE_REPEAT_DISABLED` (`scene/main/viewport.h:420`,
applied at `scene/main/viewport.cpp:4009`). The loader chose Repeat for both, so
the canvas had to undo a decision made somewhere it could not see.

The deeper problem is the shape of the choice, not its direction. A loader that
writes wrapping is a hidden global: it decides for consumers it has never met,
and a consumer that trusts the shared entry's wrapping inherits an answer it
never asked for. Mutating a shared cache entry to suit one consumer is also a
latent bug, because a 2D and a 3D consumer of the same path cannot both own one
texture's sampler state.

## Decision

**The loader leaves wrapping at three's clamp-to-edge default and states nothing
about repeat. A consumer that needs a wrapping states it at bind time.**

- A 3D material reads `texture_repeat` through `applyTextureState`, which
  compares the wanted wrapping with what the texture carries. Default or `true`
  asks for Repeat, and `false` asks for clamp. Only a texture already wrapped as
  the binding wants stays shared. Anything else becomes a source-shared clone
  with the wanted wrapping.
- The 2D canvas (`useCanvas2DTexture`) forces clamp, which is what Godot's
  canvas resolves to. A file-loaded entry already arrives clamped, but a
  procedural producer can hand over Repeat (a seamless `NoiseTexture2D`), so the
  force stays.
- The panorama sky samples with `fract(atan(...))`, so u wraps 0..1 and must
  tile. It states Repeat through the same `applyTextureState` rule
  (`skyPanoramaTexture`), frees its clone once the cube is rendered, and never
  mutates the shared entry.

A consumer that binds the shared entry directly, with no wrap of its own
(`Decal`, `PointLight2D` and the other 2D draws outside `useCanvas2DTexture`),
inherits the loader's clamp. That is what Godot draws for them: a light texture
and a canvas draw clamp, and a decal projects box-local UVs in 0..1. The
`PointLight2D` test pins this on a loader-produced texture.

## Consequences

A default 3D material over a clamped shared entry now clones, where it used to
share. The cost is one extra `Texture` per distinct clamped image a 3D material
binds. The benefit is that the shared entry is never mutated, so the same path
serving a 2D item and a 3D surface gives each its own sampler state instead of
one silently winning over the other.

A binding clone belongs to the material that made it. A GLB surface that takes a
cloned `.tres` material copies each owned texture, so the material processor
can free its own clones without freeing a texture the GLB template still samples.

Wrapping is absent from the loader, and each consumer that needs Repeat says so
where it binds. There is no default to discover by reading a file that does not
mention the consumer.

Clamp is three's own default, so a hand-built `new THREE.Texture()` behaves the
way three promises. A test that wants a tiled texture seeds Repeat rather than
relying on the loader to apply it.

The comparison runs both ways, which has one edge worth naming: clamping a
texture that already tiles is a divergence, so `repeat = false` on a tiled entry
clones.
