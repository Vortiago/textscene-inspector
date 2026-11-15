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
- Its rules are `camera` (`editor` or `elected`), `drawsEditorChrome` and `previewsEnvironment`.
  They are fields, not a kind of viewport: the In-game view is a root viewport with the game's
  rules, and the editor's view is a root viewport with the editor's.
- An adapter builds a description from its source. `rootViewportDescription` reads the project
  through the `project*` readers and gives the editor's rules. `useRootViewportDescription` keeps
  one object while the project settings object holds.
- Each render of the root reads its facts from the description: the Compositor, the 2D canvas
  frame, `SceneMipmapBias`, the anisotropic level and the light pass. The light pass builds the root
  atlas again when the atlas settings change by value.

The SubViewport node is the second adapter, and the In-game view the third. Until they arrive, the
three rule fields have no reader. That is the one exception to the rule that a field arrives with
its first reader.

## Consequences

- A project's `rendering/lights_and_shadows/positional_shadow/atlas_size` and quadrant
  subdivisions reach the root's omni and spot shadows.
- A new root fact is one field and one reader of the project, not a new read in each renderer.
- `atlas_16_bits`, `directional_shadow/size` and the soft shadow filter quality stay constants.
  They are settings of the render server, not of a viewport.
- A `.mobile` override of a setting is not read: the previewer models the desktop feature set.
