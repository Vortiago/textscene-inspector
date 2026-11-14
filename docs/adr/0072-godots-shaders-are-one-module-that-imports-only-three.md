# Godot's shaders are one module that imports only three

- Status: Accepted. The owner asked for the shape on 2026-11-12, and chose the package name, the
  place of the shader transpiler, the first publish and the three range. Amended on 2026-11-13 by
  the passes amendment below, which replaces each sentence that leaves a pass to the caller, and
  by ADR-0076, the transpiler.
- Amends: ADR-0055 (where the node materials live).
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

**The node materials live in one directory of core, `shaders/`, and `@textscene/three-godot-shaders`
publishes it.**

- **The module imports three and `godot/`, and nothing else.** That is `three`, `three/tsl`,
  `three/webgpu`, `three/addons/*`, a file of `godot/` and a file of its own. A test walks the
  import closure of its entry, as `linter/reactFree.test.ts` does, and an ESLint
  `no-restricted-imports` block reports a leak in the editor.
- **A directory of core, not a workspace package.** The nodes read engine facts of `godot/`, such as
  the roughness limiter and the soft shadow kernel. A workspace package cannot import the private
  core, and core would import the package, which is a cycle. A directory bundles those facts as
  `@textscene/tscn` bundles the parser.
- **`apps/textscene-three-godot-shaders` builds the bundle.** `three` is its only peer and it has no
  dependency. The peer range is one three minor, because TSL and `WebGLNodesHandler` change between
  minors. The package stays at 0.x, and a three upgrade in this repository is a new minor.
- **The renderer bundles the module too.** `@textscene/renderer` does not depend on
  `@textscene/three-godot-shaders`, as it does not depend on `@textscene/tscn`. One release then
  never waits for another.
- **The module declares the types of its inputs.** A surface is the properties of Godot's
  `BaseMaterial3D` under Godot's names, with a `THREE.Texture` in each texture slot. A pipeline
  input is a plain three value: a texture, a matrix or a typed array. The resource slice decodes
  into the surface type. The module reads no parsed resource and no React context.
- **Each pipeline input is optional.** The shadow atlas, the sky radiance, the probes, the decals,
  the lightmap and the screen-space textures come from passes. A surface with no value for an input
  draws what Godot draws without that feature. The passes move into the module (see the amendment).
- **The inputs belong to one object for each renderer.** A node is built once and reads each value
  in its update callback, from the inputs of the renderer that draws. No node imports the owner of a
  value. The registration of a light node is page-wide, because three keeps the node class on the
  light class (r187 `src/lights/Light.js:18-22`). It happens in the install call, never on import.
- **The transpiler of Godot's shading language lives in the module** (ADR-0076), under
  `shaders/language/`. Godot's own shaders and a user's `ShaderMaterial` both run through it. The
  surface outputs, the values Godot's `fragment()` writes, such as `ALBEDO`, are the seam between a
  surface and the lighting model until the transpiled scene template reads them under the names
  Godot's compiler gives.
- **The React mount stays in the renderer.** ADR-0039's two adapters remain: a plain object for the
  resource pipeline and a JSX element for React. Both take their material from the module.

The first publish is 0.1.0, after the port removes the shader patches. It supports `WebGLRenderer`
with `WebGLNodesHandler`, as ADR-0055 ports nothing that only `WebGPURenderer` needs.
`WebGPURenderer` has its own issue (#1788).

## Considered options

- **Keep the nodes under `r3f/` and publish nothing.** No rule then stops a node from reading a
  React context, and a later split pays for each such read.
- **Move the renderer's passes into the module with the nodes.** A three.js app would get shadows
  and sky light with no pass of its own. The passes still publish their values through the shader
  patches, which the last slice of the port removes. The first text of this ADR left the passes
  with the caller. The amendment takes this option.

## Consequences

- A plain three.js page is the second caller of the module. One golden drawn by such a page, with no
  React on it, proves the rule before the first publish.
- An app that draws with the package needs no pass of its own: the first publish gives it Godot's
  shadows and sky light too.
- A three upgrade that breaks a node breaks a published package, not only this repository. The
  generated-GLSL tests of the port run against the three version the package names.

## Amendment: the passes are part of the module

On 2026-11-13 the owner decided that the port of Godot's shaders includes the passes (ADR-0075).
The first text said "The renderer's passes stay in `r3f/` and fill the inputs" and "The caller
supplies each pipeline input". Both are withdrawn.

- The shadow passes, the sky bake, the probe capture, the decal atlas, the lightmap inputs and the
  screen-space passes move into `shaders/`, and the package publishes them (#1451 and its
  sub-issues).
- A **Pipeline input** stays the seam between a pass and a node. The module fills each one, so the
  caller of the package must supply none.
- The first publish, 0.1.0, is the package from which a plain three.js app draws a Godot scene, a
  user's `ShaderMaterial` included.

The structure of the port follows Godot's shading language, with the transpiler first (ADR-0076).
The module boundary, the import rule and the package above still hold.
