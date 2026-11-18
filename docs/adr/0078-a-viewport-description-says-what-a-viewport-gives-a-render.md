# A viewport description says what a viewport gives a render

- Status: Accepted.
- Related: ADR-0025 (the editor's preview sun and environment), ADR-0052 (MSAA never comes from the
  drawing buffer), ADR-0061 (the compositor tone maps and encodes once).

## Context

Godot gives each viewport its own render facts: MSAA, debanding, a transparent background, the
mipmap bias, the positional shadow atlas and the anisotropic level. The root viewport takes them
from the project settings (`scene/main/scene_tree.cpp:2079-2141`). A SubViewport takes them from
its own properties.

The previewer read the root's facts in each place that drew with them. The Compositor read MSAA,
debanding and the transparent background, `SceneMipmapBias` read the bias, and the light pass
built the root's atlas from a constant. A reader that missed a setting drew the default, as the
atlas did.

## Decision

**One value, the `ViewportDescription` (`r3f/viewportRender/viewportDescription.ts`), says what a
viewport gives each render it draws.** It is free of React and three.

- Its facts are `msaa2D`, `msaa3D`, `usesDebanding`, `transparentBackground`, `mipmapBias`,
  `positionalShadowAtlas` and `anisotropicLevel`.
- Its facts are also `fallbackEnvironment`, the `res://` Environment the viewport's own world draws
  with when no WorldEnvironment holds one. The root takes the project's `default_environment`. A
  SubViewport takes none.
- Its rules are `camera` (`editor` or `elected`), `drawsEditorChrome` and `previewsEnvironment`.
  They are fields, not a kind of viewport: the In-game mode draws a root viewport with the game's
  rules, and the editor's view draws a root viewport with the editor's.
- An adapter builds a description from its source. `rootViewportDescription` reads the project
  through the `project*` readers and gives the editor's rules. `useRootViewportDescription` keeps
  one object while the project settings object holds.
- `subViewportDescription` is the second adapter. It reads a SubViewport's own properties. Where
  the scene sets no mipmap bias or anisotropic level, it takes the root's.
- **Every world draw runs inside `drawWorld(render, draw)`** (`r3f/viewportRender/worldRender.ts`).
  A `WorldRender` holds the viewport's description, its shadow atlas, whether the draw goes through
  a canvas transform, and the probe capture when there is one. The root Compositor, each SubViewport
  pass, each Control raster pass and each reflection probe face draw this way.
- **An observer reads the render it draws for from `renderUnderWay()`**, not from a side table of
  cameras or targets. The shadow fitter reads the atlas, the decals the mipmap bias, the sky, fog,
  probes and screen-space effects the probe capture, and the canvas layers the canvas transform.
  Renders nest: a SubViewport's 3D draw inside its 2D pass reads its own render, and the outer
  render returns after it.
- A null `shadowAtlas` means the root viewport's atlas, which each scene's shadow fit builds from
  the root description, as Godot gives every viewport its own (`renderer_viewport.cpp:961`). A
  reflection probe capture draws in its scene's own 1024 atlas, as Godot's scenario does
  (`renderer_scene_cull.cpp:430-435`, `:3691`).
- `gameViewportDescription` is the third adapter: the root's facts with the game's rules. The In-game
  mode draws the root viewport through the SubViewport pass with it, so the root and a SubViewport
  share one pass module and each brings its own description.
- `drawsEditorChrome` has its reader in the SubViewport pass. The world reads `camera`
  (`worldExposure.tsx`) and `previewsEnvironment` (`usePreviewYield`) from the description, and no
  kind of world decides them.

## Consequences

- A project's `rendering/lights_and_shadows/positional_shadow/atlas_size` and quadrant
  subdivisions reach the root's omni and spot shadows.
- A new root fact is one field and one reader of the project, not a new read in each renderer.
- A new observer of a render reads `renderUnderWay()`. A new kind of draw calls `drawWorld`.
- `atlas_16_bits`, `directional_shadow/size` and the soft shadow filter quality stay constants.
  They are settings of the render server, not of a viewport.
- A `.mobile` override of a setting is not read: the previewer models the desktop feature set.
