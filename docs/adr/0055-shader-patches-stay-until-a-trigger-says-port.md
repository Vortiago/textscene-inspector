# Shader patches stay until a trigger says port

- Status: Superseded by ADR-0076 for the port. The shader patches and their anchor checks below
  stay until the port removes them. Amended on 2026-11-11 (TSL node materials, the port started)
  and on 2026-11-13 (the port is Godot's shaders, ADR-0075).
- Related: ADR-0038 (one owner for every program input), ADR-0039, ADR-0072 (the module the node
  materials live in), ADR-0075 (the goal that sets the scope of the port).

## Context

The renderer draws Godot's lit surface by splicing Godot's GLSL into three's built-in shader chunks
and programs at string anchors. The patches install from `r3f/shaderPatch/installShaderPatches.ts`,
and `programInjections.test.ts` lists the program injections.

A port of Godot's scene shader into our own `ShaderMaterial` costs 40 to 50 files, and every 3D
golden moves. The cost grows by about 15% per 20 rendering pull requests. A port now costs about
the same as a port later, so the calendar does not decide when to port.

## Decision

Keep the splices while the port runs, and make a missed anchor fail loudly.

- Every edit of a program's text goes through `r3f/shaderPatch/chunkPatch.ts`. `editedShader`
  throws when an anchor does not occur exactly once. `installChunkEdits` warns, and the tests
  throw on that warning. `shaderTextSpliceConformance.test.ts` rejects a raw `.replace` on shader
  text.
- `programInjections.test.ts` installs every global patch, and applies every program injection to
  three's real programs. A three.js upgrade then shows a list of failing anchors, not wrong pixels.
  Its list of injections is the list the port must replace.
- `r3f/shaderPatch/lightLoopEdits.test.ts` counts the edits to the light and shadow chunks and fails
  past 80.

The port is TSL node materials. They draw on `WebGLRenderer` through three's `WebGLNodesHandler`,
and the same nodes draw on `WebGPURenderer` later. A `ShaderMaterial` does not run on the WebGPU
backend. [`docs/webgpu-tsl-spike.md`](../webgpu-tsl-spike.md) holds the measurements. ADR-0076
records how the port is built: Godot's shading language through one transpiler, Godot's own
shaders and a user's shaders alike.

While the port runs:

- The node path stays behind one switch. With the switch off, every golden stays pixel-identical.
- A change to the lit surface lands in the node path, not in a new patch.
- A golden may move by at most 1/255 when a material switches to nodes, and only if its comparison
  with Godot does not get worse.
- The webview bundle ceiling is 1,150,000 B. The pull request that removes the patches measures the
  bundle and proposes the next ceiling.

## Consequences

The anchor test does not catch three changing code next to an anchor that it keeps. The goldens
catch that. The port has its own issues. It is not a change inside another pull request.
