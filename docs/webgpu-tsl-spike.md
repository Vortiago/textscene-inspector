# The TSL and WebGPU spike

This document reports what a prototype of Godot's lit surface in three's shading language (TSL)
measured. It answers the nine questions of issue #1231 and recommends a migration path. It
changes no decision: ADR-0055 stays as it is until its owner decides.

## The result

- A TSL node material draws Godot's lit surface on today's `WebGLRenderer`, through three's
  `WebGLNodesHandler` (the handler). On `unit-directional-light-3d.tscn`, 1 pixel differs from the
  golden, by 1/255.
- The same node graph draws on both backends of `WebGPURenderer`, and the two backends agree to
  the pixel.
- The real canvases do not run on `WebGPURenderer`. The shadow pass and the 2D light targets read
  parts of `WebGLRenderer` that `WebGPURenderer` does not have.
- The handler has limits that a port must design for: the shadow depth pass, multiple render
  targets and the uniform block count.
- The handler and the node system add 86,445 B to the webview bundle, which passes the 1,000,000 B
  ceiling by 20,897 B.

The recommendation is a port of the lit surface to TSL node materials under the handler, behind a
switch, and a move to `WebGPURenderer` as a later and separate project.

## What the prototype is

| Item | Value |
| --- | --- |
| Branch | `claude/project-thread-h5eutl` |
| Prototype commit | `1e9bd589822e` |
| Base commit on `main` | `8a7e571c` |
| three | 0.187.0 |
| @react-three/fiber | 9.8.2 |
| @react-three/test-renderer | 9.1.1 |
| postprocessing | 6.39.6 |
| Browser | Chromium 156.0.8078.4, bundled with Playwright 1.64.1 |
| Godot | 4.6.3.stable |

The prototype commit is on the branch of this document's pull request. A later commit on the same
branch removes the prototype, so the pull request changes only this document.

The prototype has three parts.

- `packages/textscene-core/src/r3f/tslSpike/` holds the lit surface in TSL. It ports the light
  function, the indirect specular, the sky lighting, the sun's split shadow and the cookie quad of
  a `PointLight2D`.
- A URL parameter, `?renderer=`, picks one of four renderer paths in the real canvases: `classic`,
  `handler`, `webgpu` and `webgpu-webgl2`.
- `scripts/tsl-spike/` holds the capture scripts, and a lab page that runs one experiment at a time
  outside the application.

The container has no GPU. Every picture and every frame time below comes from a software
rasteriser: SwiftShader, or lavapipe for the comparisons with Godot.

## Parity in 3D

The scene is `scenes/fixtures/unit-directional-light-3d.tscn`. The golden is
`scripts/visual/baselines/directional-light-3d.png`. The Godot comparison is `pnpm ref:diff` at
955 by 756 pixels on lavapipe.

| Renderer path | Against the golden | Against Godot 4.6.3 |
| --- | --- | --- |
| `classic` | 0 px | 87,936 px (12.180%), max 5/255, mean 0.043/255 |
| `handler`, lit surface in TSL | 1 px, max 1/255 | 87,936 px (12.180%), max 5/255, mean 0.043/255 |
| `webgpu` | no picture | no picture |
| `webgpu-webgl2` | no picture | no picture |

Under lavapipe the handler's picture equals the classic picture exactly. Under SwiftShader one
pixel rounds the other way. The cause of that pixel is not traced.

`WebGPURenderer` mounts in the 3D canvas and then fails at `r3f/shadowPass.ts:91`, which binds
`renderer.shadowMap.render`. `WebGPURenderer` has no `shadowMap.render`, and no `properties`,
`state`, `extensions` or `capabilities`.

The lab draws the same node graph on all three paths, at 640 by 480 pixels, with its own sky and
its own shadow atlas.

| Pair | Difference |
| --- | --- |
| Handler against the WebGL 2 backend | 9,666 px (3.146%), max 1/255, mean 0.010/255 |
| Handler against the WebGPU backend | 9,666 px (3.146%), max 1/255, mean 0.010/255 |
| WebGL 2 backend against the WebGPU backend | 0 px |

`WebGPURenderer` draws into a half-float buffer before it writes the canvas, and the handler does
not. That is the probable cause of the 1/255 differences. The spike did not confirm it.

## Parity in 2D

The scene is `scenes/fixtures/unit-pointlight2d.tscn`. No golden draws this exact scene, so the
comparison is with a capture of the `classic` path. The Godot comparison is at 1152 by 648 pixels.

| Renderer path | Against the classic capture | Against Godot 4.6.3 |
| --- | --- | --- |
| `classic` | 0 px | 486,143 px (65.123%), max 1/255, mean 0.650/255 |
| `handler`, cookie quad in TSL | 0 px | 486,143 px (65.123%), max 1/255, mean 0.650/255 |
| `webgpu` and `webgpu-webgl2` | no picture | no picture |

`WebGPURenderer` fails in the 2D canvas at `r3f/lighting2d/lightAccumulationTargets.ts:42`, which
reads `gl.extensions`. In the lab, the cookie quad at 256 by 256 pixels differs by 0 px between the
handler and the WebGL 2 backend. It differs by 6,314 px (9.634%), max 1/255, on the WebGPU backend.

The prototype ports only the cookie quad without a shadow. The rest of 2D lighting needs a port
before `WebGPURenderer` can draw it:

- three files of GLSL under `r3f/lighting2d/`,
- four files that edit a program in `onBeforeCompile`,
- six files that build a `ShaderMaterial`, among them the shadow volume mask,
- the light accumulation targets, which are `WebGLRenderTarget` objects.

None of this needs a port for the handler step. The handler leaves a classic material alone.

## The WebGPU adapter

| Launch | Adapter |
| --- | --- |
| The golden launch (`--use-angle=swiftshader`) | `navigator.gpu` exists, and `requestAdapter` answers "No available adapters" |
| `webgpu-swiftshader` | Google SwiftShader, a fallback adapter |
| lavapipe | Not reached |

The `webgpu-swiftshader` launch uses these flags:

```
--enable-unsafe-swiftshader --ignore-gpu-blocklist --use-gl=angle --use-angle=swiftshader
--enable-unsafe-webgpu --enable-features=Vulkan --use-vulkan=swiftshader
--use-webgpu-adapter=swiftshader
```

Without `--use-vulkan=swiftshader`, a screenshot of a WebGPU canvas is blank, and so is a 2D copy
of it. On lavapipe, WebGL reports llvmpipe (Mesa Vulkan 1.4.318). Dawn still answers its
SwiftShader adapter under each of the five flag sets the spike tried.

`readRenderTargetPixelsAsync` reads pixels on both backends. Its rows start at the top on the
WebGPU backend and at the bottom on the WebGL 2 backend. The visual gate can therefore read a
WebGPU frame without a screenshot.

## Frame time

Each run draws 600 frames after 60 warm-up frames. `gl.finish` does not block in Chromium, so each
frame ends with a read of one pixel. "CPU" is the time inside the render call. "GPU done" is the
time until the pixel read returns. Each cell is the median and the 95th percentile, in milliseconds.

The real 3D canvas on SwiftShader, `unit-directional-light-3d.tscn`:

| Path | Marker boxes | Draw calls | CPU | GPU done | First frame |
| --- | --- | --- | --- | --- | --- |
| `classic` | 0 | 20 | 0.8 / 5.0 | 287 / 315 | 2,269 |
| `handler` | 0 | 20 | 0.9 / 5.6 | 268 / 299 | 2,352 |
| `classic` | 400 | 2,020 | 14.7 / 20.2 | 359 / 397 | 3,055 |
| `handler` | 400 | 2,020 | 26.6 / 33.7 | 348.5 / 382 | 2,980 |

The lab on SwiftShader, one lit surface at 640 by 480 pixels:

| Path | Marker boxes | CPU | GPU done | First frame |
| --- | --- | --- | --- | --- |
| `classic`, three's own material | 0 | 0.10 / 0.20 | 4.5 / 6.3 | 62 |
| `handler` | 0 | 0.40 / 0.60 | 27.5 / 33.2 | 151 |
| WebGL 2 backend | 0 | 0.40 / 0.80 | 37.4 / 43.7 | 215 |
| WebGPU backend | 0 | 0.50 / 1.20 | 40.3 / 47.0 | 88 |
| `classic`, three's own material | 400 | 1.40 / 2.50 | 21.7 / 25.1 | 67 |
| `handler` | 400 | 4.80 / 8.30 | 70.9 / 83.4 | 186 |
| WebGL 2 backend | 400 | 5.20 / 7.80 | 64.9 / 75.9 | 273 |
| WebGPU backend | 400 | 5.90 / 10.80 | 69.6 / 79.1 | 174 |

The lab's classic row draws three's `MeshStandardMaterial`, not Godot's shading. It is a cost
reference only.

Two facts hold on a software rasteriser. The handler costs about 6 microseconds more CPU time per
draw call, because it updates the nodes of each material before each draw. The time on the
rasteriser itself does not change between `classic` and `handler` in the real canvas.

No number here says what a GPU does. Run this on a machine with one, once for each path and box
count:

```
node scripts/tsl-spike/frameTime.mjs unit-directional-light-3d.tscn --renderer handler --boxes 400 --browser hardware
```

The script is in the prototype commit.

## Bundle size

`scripts/check-bundle-size.mjs` measures the webview's initial chunk, gzipped. The ceiling is
1,000,000 B.

| State | Size | Change |
| --- | --- | --- |
| `main` | 934,452 B | |
| With the handler and the node system | 1,020,897 B | +86,445 B |
| With `WebGPURenderer` too | 1,114,182 B | +179,730 B |

While classic materials and node materials ship together, no code can go without a loss of
function. The 86,445 B is three's node system, after tree shaking. The patch files can go only
when the last classic lit material goes. The spike did not measure what that removal saves.

## Samplers and limits

| Item | Value |
| --- | --- |
| Samplers in the classic lit fragment program of the fixture | 10 |
| Samplers in the TSL lit fragment program | 3, and 4 uniform blocks |
| WebGL 2 texture units on SwiftShader | 32 per stage, 64 combined |
| WebGPU adapter: sampled textures per stage | 16 |
| WebGPU adapter: samplers per stage | 16 |
| WebGPU adapter: uniform buffers per stage | 12 |
| WebGPU adapter: bind groups | 4 |
| WebGPU adapter: texture size, array layers | 8,192 and 256 |

The classic program declares a sampler for each feature the patches know, used or not. A TSL
program holds a sampler only when its node is in the graph. The prototype's three are the DFG
table, the sun's shadow atlas and the sky's layers.

- #1226 asks for a define to gate the scene samplers. A node material needs no such gate, so the
  issue closes with the port of the features it names.
- #1227 asks to drop features above the device limit. It stays, in another form: a count of the
  texture nodes of a material against the adapter's 16.
- #968 is the same count on WebGL 2.

The handler turns each `uniformArray` into one uniform block. The prototype's sun uses two arrays,
and the golden `directional-light-limit` then fails to link: "FRAGMENT shader uniform block count
exceeds GL_MAX_FRAGMENT_UNIFORM_BUFFERS (14)". A port must pool the lights of one kind into shared
arrays, as three's classic renderer does.

## The 3D goldens one slice moves

`scripts/tsl-spike/goldensMoved.mjs` captures every 3D golden on the `handler` path and compares
it with its baseline. The slice is the prototype's: Godot's default lit surface, the sky and
directional lights.

The sweep covers 377 goldens and was still running when this version was written. Its counts
follow in the next commit.

## The eight additions

1. **The handler in `TscnCanvas`.** `renderer.setNodesHandler(new WebGLNodesHandler())` in
   `onCreated` works under fiber 9.8.2. The handler tone maps and converts each output unless
   `getOutputCallback` answers the output node unchanged.
2. **The shadow pass under the handler.** Not solved. `WebGLShadowMap` knows no node material. A
   caster with a node `positionNode` casts its shadow from the unmoved mesh. A node
   `customDepthMaterial` draws no caster. Until three changes this, each caster needs a classic
   depth material.
3. **The transpiler on `godotLightFunction.ts`.** three's GLSL to TSL transpiler accepts the patch
   text and gives a wrong result without an error. It drops every preprocessor branch but the
   first. It leaves `RECIPROCAL_PI`, `saturate` and `pow2` undefined. With the default branches
   resolved by hand and the helpers written out, its output compiles and equals the hand-written
   nodes to the pixel. It can draft a port, and each draft needs a reader.
4. **The bundle size.** See "Bundle size".
5. **The goldens one slice moves.** See the section above.
6. **A full-screen node material under the handler.** It equals its `ShaderMaterial` copy exactly,
   once the pass turns its rows with `uv().flipY()`. With plain `uv()` the picture is upside down.
7. **The unit-test seam.** A `WebGPURenderer` that never starts builds a node graph into GLSL with
   no GL context, in 21 ms under happy-dom. A test can then assert on the generated text. A node
   material also mounts under `@react-three/test-renderer`.
8. **WebGPU pixels in the harness.** See "The WebGPU adapter".

TSL has two conventions that differ from the classic renderer on all three paths.
`screenCoordinate` counts rows from the top. A texture node turns the rows of every depth texture,
render target texture and framebuffer texture. A value that crosses from classic code into a node
graph needs its conversion at that boundary, in one place.

## The nine questions

### 1. What do the chunk patches become?

The 29 patches hold 106 edits, 78 of them in the light and shadow chunks. In TSL they fall into
four kinds.

| Kind | Patches | TSL form |
| --- | --- | --- |
| Lighting model | light function, light attenuation, specular, occlusion, light specular, light bake mode, light size, sky lighting, area light, clearcoat, reflection probe | One `LightingModel` class and one node for each light kind |
| Shadows | split shadow, soft shadow filter, sun shadow atlas, positional shadow | A shadow node for each light kind |
| Surface inputs | unlit varyings, normal map read, emission exposure, sRGB multiply, refraction, decal, screen-space ambient occlusion, screen-space reflection, normal-roughness prepass | Nodes that the material adds only when the surface uses them |
| Fog and background | fog, cube background fog, flat background fog, sky projection, sky debanding | A fog node, and node materials for the backgrounds |

The prototype ports nine of the 29, in whole or in part: light function, specular, occlusion,
light specular, light size, sky lighting, split shadow, soft shadow filter and sun shadow atlas.
It leaves out the blocker search of a sun with an angular size, and every diffuse mode but Burley
and Lambert.

### 2. What other GLSL does the renderer hold?

These counts come from a text search, so each is approximate.

| What | Files |
| --- | --- |
| GLSL in a template string | 69 |
| `onBeforeCompile` | 27 |
| `ShaderMaterial` built directly | 8 |
| `ShaderChunk`, `ShaderLib` or `UniformsLib` | 13 |
| `WebGLRenderTarget` | 39 |
| `postprocessing` | 2 |

The handler step needs none of these ported, except the materials that move to nodes.
`WebGPURenderer` needs all of them ported. Ten places also call WebGL directly, for example
`tiledUpload/`, `multisampledTarget.ts`, `nearestAnisotropy.ts` and `shadowFilter/uncomparedDepth.ts`.
Each needs a WebGPU form or a decision to drop it.

The normal-roughness prepass draws each surface into a target with two textures
(`prepassBuffers.ts:76`). The handler does not support multiple render targets
(`WebGLNodesHandler.js:31-36`). The prepass therefore keeps a classic material under the handler.
The spike read this in the source and did not run it.

### 3. What should ADR-0055 say?

ADR-0055 names the port as "one `ShaderMaterial` per shading mode". A `ShaderMaterial` does not run
on the WebGPU backend, so that port would be done a second time. The measurements support TSL node
materials as the form.

Trigger 2 counts edits in the light and shadow chunks, and the count is at 78 of 80. If the port
starts, the count needs no higher limit. If the port waits, the limit rises or new light work
stops. The ADR's owner decides which.

### 4. What happens to postprocessing?

Two files use the `postprocessing` package: `GodotToneMapEffect.ts` and `toneMapPass.ts`. Under the
handler they run unchanged. The 3D parity row above includes the tone map pass.

The `postprocessing` package needs `WebGLRenderer`. On `WebGPURenderer`, the tone map effect
becomes a node on three's `RenderPipeline`. The spike did not build that.

### 5. What changes in fiber?

Fiber 9.8.2 accepts an asynchronous `gl` factory. A canvas with `shadows="percentage"` and `flat`
mounts on both backends. The third frame arrives 431 ms after the mount on the WebGPU backend and
506 ms on the WebGL 2 backend.

33 files read `state.gl`, at 59 places, and 64 files name the type `THREE.WebGLRenderer`. Each is
a place a move to `WebGPURenderer` must visit. The handler step visits none of them.

`@react-three/test-renderer` 9.1.1 mounts a node material and advances frames. It loads a CommonJS
copy of three. The spike did not test fiber 10.

### 6. Does WebGPU run in a VS Code webview?

Not measured. The extension asks for VS Code 1.105 or later. The handler step needs only WebGL 2,
so it carries no risk in the webview. Before any move to `WebGPURenderer`, the
`drive-vscode-extension` skill should request an adapter in the real webview on each operating
system.

### 7. Should the shader translator emit TSL?

Yes, for a shader that the lit surface must light. A node material takes the shader's outputs as
nodes, for example `colorNode` and `roughnessNode`, and Godot's lighting model then lights them
with no second copy.

three also has `glslFn`, which wraps a GLSL function in a node. It runs only where the backend
compiles GLSL, so it does not reach the WebGPU backend. The spike did not test it. It may serve as
a short path for #686 and #729, which draw unlit canvas shaders.

### 8. What does it cost in performance?

See "Frame time". The handler adds CPU time for each draw call, and a first frame that is about 4%
later in one run and 2% earlier in the other. The cost on a GPU is not measured.

### 9. What is the migration path?

See the next section.

## The recommended path

The order keeps every golden under the visual gate at each step.

1. Decide the form in ADR-0055, and the bundle ceiling for the period with both material kinds.
2. Install the handler with no node material. Add the unit-test seam and the goldens sweep script.
   A sweep must show every golden identical.
3. Build the node lit surface behind a switch, one kind of patch at a time, in the order of the
   table in question 1. The sweep reports the goldens that still differ.
4. Pool the per-light arrays, and give each caster a classic depth material, before the lights
   and shadows land.
5. When the sweep shows no difference above the accepted threshold, make the node lit surface the
   default.
6. Remove the patches and the switch. ADR-0055's anchor tests go with them.
7. Decide on `WebGPURenderer` as its own project. Its work list is in questions 2, 4, 5 and 6.

Step 3 is the long step. While it runs, a change to the lit surface must land in the patch and in
the node graph. Group 3 holds 25 issues in that code. The path costs least when group 3 waits for
step 5, or when group 3 lands first and the port follows.

## Not measured

- Frame time on a GPU.
- WebGPU in the VS Code webview.
- Fiber 10.
- The tone map effect on `RenderPipeline`.
- WebGPU on lavapipe, and so a WebGPU comparison with Godot.
- A picture of a real canvas on `WebGPURenderer`.
- The sampler and binding counts of the generated WGSL.
- `glslFn` as a target for the translator.
- The bundle size after the patches go.
- The handler installed with no node material, over the goldens.

## Decisions for the owner

1. Is the port form TSL node materials, in place of ADR-0055's `ShaderMaterial`?
2. Is the handler the first step, with `WebGPURenderer` as a later project?
3. What is the bundle ceiling while both material kinds ship? The measured size is 1,020,897 B.
4. May a golden move by 1/255 at the switch, or must the port find each such pixel first?
5. Does group 3 wait for the port, or does the port wait for group 3?
6. Does the prototype stay on a named branch? It is now reachable only through its commit.
