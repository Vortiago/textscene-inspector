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
  `resolveFontOrDefault`. The Control chain differs only in the ancestor themes it adds.
- One reader opens every font container. A WOFF or WOFF2 file decodes to the plain sfnt tables
  that the TrueType and CFF outline readers already parse. A transformed WOFF2 `glyf` is rebuilt
  to a plain `glyf` and `loca`. No container has an outline path of its own.
- A font that is still loading draws nothing. The bundled font is the answer for an unset or a
  failed font only, so a loading font never flashes the bundled one.

## Consequences

A project font reaches a TextMesh and a Label3D with no change to the scene. A new container adds a
decoder that returns tables, and no reader changes.
