# Every font reader takes its font from one project context

- Status: Accepted
- Related: ADR-0034 (two text painters, one shaping engine), ADR-0040 (the painter follows Godot's own glyph path).

## Context

Godot resolves a font in the same order for every node that draws text: the node's own font, the
project theme, the default theme's `default_font`, which is the project font
(`gui/theme/custom_font`) or the bundled Open Sans. A Control walks its ancestors' themes first.
A TextMesh (`primitive_meshes.cpp:3779-3809`) and a Label3D (`label_3d.cpp:812-850`) skip them.

The previewer read the project theme and the project font in the Control solve tree only. A
TextMesh and a Label3D with no font drew the placeholder or the bundled font, whatever the project
said. A font in a WOFF or WOFF2 file had metrics for the 2D text and no outlines for the mesh.

## Decision

- One source gives the project theme and the project font: `resolveProjectFonts`. The Control
  solve tree calls it in its walk. A node outside the solve tree reads it through `useProjectFonts`.
- A node with a `font` property and no theme of its own resolves the chain through
  `fontForNode`. The Control chain differs only in the ancestor themes it adds.
- One reader opens every font container. A WOFF or WOFF2 file decodes to the plain sfnt tables
  that the TrueType and CFF outline readers already parse. A transformed WOFF2 `glyf` is rebuilt
  to a plain `glyf` and `loca`. No container has an outline path of its own.
- A font that is still loading draws nothing. The bundled font is the answer for an unset font,
  or for bytes that FreeType opens and only the browser cannot load, so a loading font never
  flashes the bundled one.
- FreeType decides whether a font file opens, as `FT_Open_Face` does in Godot
  (`freeTypeOpen.ts`). A face it cannot open draws no text, and no fallback after it draws either.
  An empty file has no face to open: its characters fall to the chain, then to hex-code boxes.
- A font loads in two stages. The font bus carries its file. The settled fonts of the preview
  (`settledFonts.ts`, held by the preview's `ResourceLoader`) then load the face of each font of
  its **Fallback chain**. A reader gets one answer, a **Settled font**: none, loading, or the face
  with its chain. A component reads it through `useSettledFont`, which re-renders it when that font
  settles. A settle wakes the readers of the fonts it settles, and of no other font. The Control
  solve tree hands each node a view of the settled fonts that records each font its solve and its
  painters await, and rebuilds when one of those settles. A mesh build reads the `settledFonts`
  its context carries, and re-renders on a settle of its preview only.
- A host gives the face loader through `ResourceLoaderOptions.loadFace`. Without one, the loader
  registers a `FontFace`. A test gives a loader that answers a stand-in face, or one that stays pending.

## Consequences

A project font reaches a TextMesh and a Label3D with no change to the scene. A new container adds a
decoder that returns tables, and no reader changes. A font that settles in one preview wakes no
reader of another. Two previews that draw one font load its face once each.
