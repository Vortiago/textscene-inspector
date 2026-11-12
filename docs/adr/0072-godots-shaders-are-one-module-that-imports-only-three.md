# Godot's shaders are one module that imports only three

- Status: Proposed. The owner asked for the shape on 2026-11-12. The package name, the place of the
  shader translator, the first publish and the three range wait for his answer.
- Amends: ADR-0055 (where the node lit surface lives).
- Related: ADR-0038 (one owner for every program input), ADR-0039 (one material derivation, two
  adapters), ADR-0041 (an uncompiled shader draws Godot's default surface).

## Context

ADR-0055 ports Godot's lit surface to TSL node materials. Its prototype, the branch
`spike/tsl-lit-surface`, puts them under `r3f/`, where a file may import React and any part of the
renderer. Six of its thirteen source files already import only three and the engine facts of
`godot/`, and a seventh reads two constants of the renderer beside them. Four mount a material in
React or borrow the shadow atlas and the sky radiance from the renderer's passes. The last two are a
2D material outside the port and the prototype's switch.

The node materials are a port of Godot's scene shader. A three.js app with no React can draw with
them, and the owner wants to publish them for that use. `@textscene/renderer` cannot serve such an
app: react, react-dom, react-three-fiber, drei and postprocessing are its peers.

## Decision

**The node materials live in one directory of core, `shaders/`, and `@textscene/godot-shaders`
publishes it.**

- **The module imports three and `godot/`, and nothing else.** That is `three`, `three/tsl`,
  `three/webgpu`, `three/addons/*`, a file of `godot/` and a file of its own. A test walks the
  import closure of its entry, as `linter/reactFree.test.ts` does, and an ESLint
  `no-restricted-imports` block reports a leak in the editor.
- **A directory of core, not a workspace package.** The nodes read engine facts of `godot/`, such as
  the roughness limiter and the soft shadow kernel. A workspace package cannot import the private
  core, and core would import the package, which is a cycle. A directory bundles those facts as
  `@textscene/tscn` bundles the parser.
- **`apps/textscene-godot-shaders` builds the bundle.** `three` is its only peer and it has no
  dependency. The peer range is one three minor, because TSL and `WebGLNodesHandler` change between
  minors. The package stays at 0.x, and a three upgrade in this repository is a new minor.
- **The renderer bundles the module too.** `@textscene/renderer` does not depend on
  `@textscene/godot-shaders`, as it does not depend on `@textscene/tscn`. One release then never
  waits for another.
- **The module declares the types of its inputs.** A surface is the properties of Godot's
  `BaseMaterial3D` under Godot's names, with a `THREE.Texture` in each texture slot. A pipeline
  input is a plain three value: a texture, a matrix or a typed array. The resource slice decodes
  into the surface type. The module reads no parsed resource and no React context.
- **Each pipeline input is optional.** The shadow atlas, the sky radiance, the probes, the decals,
  the lightmap and the screen-space textures come from passes of the caller. A surface with no value
  for an input draws what Godot draws without that feature. The renderer's passes stay in `r3f/` and
  fill the inputs.
- **The inputs belong to one object for each renderer.** The module keeps no state at module level,
  so two renderers on one page do not share an atlas.
- **One inner seam: the surface outputs.** They are the values Godot's `fragment()` writes, such as
  `ALBEDO`, `ROUGHNESS` and `NORMAL`. The lighting model reads only them. The surface
  `BaseMaterial3D` generates fills them, and so do a translated `ShaderMaterial` and the default
  surface of ADR-0041. The shader translator therefore lives in the same module.
- **The React mount stays in the renderer.** ADR-0039's two adapters remain: a plain object for the
  resource pipeline and a JSX element for React. Both take their material from the module.

The first publish supports `WebGLRenderer` with `WebGLNodesHandler`, as ADR-0055 ports nothing that
only `WebGPURenderer` needs.

## Considered options

- **Keep the nodes under `r3f/` and publish nothing.** No rule then stops a node from reading a
  React context, and a later split pays for each such read.
- **Move the renderer's passes into the module with the nodes.** A three.js app would get shadows
  and sky light with no pass of its own. The passes still publish their values through the shader
  patches, which the last slice of the port removes. The move waits for that slice and has its own
  issue.

## Consequences

- A plain three.js page is the second caller of the module. One golden drawn by such a page, with no
  React on it, proves the rule before the first publish.
- An app that draws with the package and has no pass of its own gets Godot's direct light, ambient
  colour and fog, with no shadow and no sky reflection.
- A three upgrade that breaks a node breaks a published package, not only this repository. The
  generated-GLSL tests of the port run against the three version the package names.
