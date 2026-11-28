# The VS Code webview loads one script file

- Status: Accepted.
- Related: ADR-0042 (the procedural-texture worker, which the script starts from a `blob:` URL).
- Amends: ADR-0055 (the webview bundle ceiling).

## Context

Desktop VS Code serves every file a webview fetches through the webview's service worker. Since
VS Code 1.130, that worker lets at most 32 response bodies from the host be open at one time
(`maxActiveHostResourceResponseBodies` in `src/vs/workbench/contrib/webview/browser/pre/service-worker.js`).
Every preview of the extension has the same webview origin, so all previews share the 32 places.

A preview that closes during its load keeps the places of its open requests. The worker frees a
place only when its request ends, and a request to a closed preview ends at the worker's 30 s
timeout (`resolveTimeout`). A request that finds no free place waits, and it gives no error.

The webview built with code splitting fetched 77 files at once on load. One preview closed during
its load took all 32 places, so every preview opened in the next 30 s loaded nothing, and a capture
ended at its 30 s load deadline (#2075).

## Decision

**The VS Code webview builds as one script file and one stylesheet.** The esbuild build of
`apps/textscene-vscode` sets `splitting: false`, so a dynamic `import()` in core is bundled into
`dist/webview/webview.js`. A preview closed during its load then holds at most two places.

`pnpm check:bundle-size` fails when the build writes a script beside `webview.js`, and when the
script is over its gzipped ceiling (`scripts/check-bundle-size/webviewBudget.mjs`). The ceiling
is the measured 2,344,036 B, so any growth raises it here with its reason. It replaces ADR-0055's 1,150,000 B, which
held only the canvas-paint closure of the split build. The bake of a sky's layers through Godot's
octmap compute stages (`shaders/template/compute`, `resources/sky/octmapPasses.ts`) adds 5,479 B of
the measure. The other 4,818 B over the measure before it are the shader branch's growth that no
measure recorded. Godot's coefficient table for the high-quality fast filter of a sky's radiance
(`skyFastFilterHighQualityCoefficients.ts`) adds 44,073 B of the measure. A lit spatial shader under
directional lights (`shaders/spatial/directionalLights.ts`, `dfgTexture.ts`, `r3f/surfaceLight`), with
the project's roughness limiter and a glTF light's Godot energy, adds 4,429 B. The sky's light on a lit
surface (`shaders/spatial/sceneSky.ts`, `r3f/surfaceLight/sceneSkyLight.ts`) adds 16 B. A Sprite2D with a
user's `canvas_item` shader and its CanvasTexture's maps (`r3f/canvasShader`, `shaders/canvas/compileCanvas.ts`)
adds 5,843 B. The same shader on tiles, Polygon2D, Line2D, MeshInstance2D and AnimatedSprite2D, with the padded
tile atlas (`r3f/canvasShader`, `resources/tileset/paddedAtlas.ts`), adds 4,032 B. A sun's hard shadow on a lit
surface adds 1,341 B. A `canvas_item` shader's screen
built-ins over Godot's viewport and the runtime tile atlas built in a worker (`r3f/canvasShader`, `workers/jobs.ts`)
add 4,489 B. A StandardMaterial3D or ORMMaterial3D drawn through the shader Godot writes for it
(`shaders/material`, `r3f/spatialShader/surfaceShader.ts`) adds 10,065 B. The texture states that end its wait and draw
the missing-texture placeholder for a shader's map (`r3f/shaderTextures`) add 2,069 B. The setter casts, the program
key's texture formats and the shared-program refusal (`shaders/material`, `shaders/uniforms`) add 2,335 B.
A canvas item without a shader of its own drawn through the canvas template behind its switch
(`r3f/canvasShader`, `shaders/canvas`) adds 1,208 B. CPUParticles2D, MultiMeshInstance2D and a skinned Polygon2D drawn through the canvas template
(`shaders/canvas/canvasMultiMesh.ts`, `r3f/canvasShader`) add 1,423 B.
A sun's soft shadow and transmittance on a lit surface, with its three reads of the stored depth and the probe that
picks one (`r3f/directionalShadow`), and the frame recording (`r3f/frameProfile`), add 2,371 B. A lit canvas item
drawn through the canvas template's lit variant, with its light rows and the shared program of one shader
(`r3f/lighting2d/lightRows.ts`, `shaders/canvas/canvasLights.ts`, `r3f/canvasShader`), adds 5,994 B, with the cull of its batches by item rect. The
texture upload count of the frame recording (`r3f/frameProfile/textureUploads.ts`) adds 42 B.

The shader translator adds about 464,000 B to the script. The groups below gzip alone, so they are shares
of that growth, not exact bytes:

| Group | Gzipped alone | What it is |
| --- | --- | --- |
| Godot's GLSL template text, all 91 files | 192,531 B | The shader source the translator links into |
| `godot/variant`, `string`, `expression`, `math` | 148,200 B | Godot's Expression and Variant, for `#if` |
| `shaders/language` | 99,821 B | The Godot shading language parser |
| `shaders/template` | 47,515 B | Template parse, link and emit |
| The spatial and sky translators | 52,960 B | `shaders/uniforms`, `spatial`, `sky` and the rest |
| `godot/classdb`, `io`, `crypto` and so on | 19,546 B | Decompression and hashes for `#if` file reads |
| The draw side of the translated shaders | 13,865 B | `r3f/sky`, `r3f/spatialShader` and the rest |

The run time reads 16 of the 91 template files now. The script ships all 91, which later slices of
the translator read, at about 140,000 B over the 16 alone.

## Consequences

- The whole script loads on each preview open: about 2.29 MB gzipped, where the canvas-paint
  closure of the split build was about 1.07 MB. A local load of the two builds took the same time,
  about 0.5 s.
- A dynamic `import()` in core stays lazy in its evaluation, and the web previewer and the
  renderer package keep their own chunks.
- A cut-off copy of the script still fails its import, and the panel loads a new document once
  (`webviewLoadFailed`). No chunk can fail after the page runs.
- About 16 previews closed during their load within 30 s still fill the 32 places. Only VS Code can
  free a closed preview's places sooner (#2077).
- `check:bundle-size` is the guard, not an integration test. A test that fails on the split build
  needs about 10 previews closed during their load, and these hold places that the suites around
  it need for 30 s.
- No check gates the web previewer's first-paint bundle size, and no check keeps modules loaded
  only on demand out of a first paint (#2078).
