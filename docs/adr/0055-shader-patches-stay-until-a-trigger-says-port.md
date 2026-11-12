# Shader patches stay until a trigger says port

- Status: Accepted. Amended on 2026-11-11: the port form is TSL node materials, and the owner started the
  port.
- Related: ADR-0038 (one owner for every program input), ADR-0039.

## Context

The renderer draws Godot's lit surface by splicing Godot's GLSL into three's built-in shader chunks
and programs at string anchors. The patches install from `r3f/shaderPatch/installShaderPatches.ts`,
and `programInjections.test.ts` lists the program injections.

A port of Godot's scene shader into our own `ShaderMaterial` costs 40 to 50 files, and every 3D
golden moves. The cost grows by about 15% per 20 rendering pull requests. A port now costs about
the same as a port later, so the calendar does not decide when to port.

## Decision

Keep the splices, and make a missed anchor fail loudly.

- Every edit of a program's text goes through `r3f/shaderPatch/chunkPatch.ts`. `editedShader`
  throws when an anchor does not occur exactly once. `installChunkEdits` warns, and the tests
  throw on that warning. `shaderTextSpliceConformance.test.ts` rejects a raw `.replace` on shader
  text.
- `programInjections.test.ts` installs every global patch, and applies every program injection to
  three's real programs. A three.js upgrade then shows a list of failing anchors, not wrong pixels.
  Its list of injections is the list a port must replace.

Port the lit surface when the first of these holds:

1. One three.js upgrade breaks 5 or more anchors, or rebasing the patches takes more than a day.
2. The edits to the light and shadow chunks pass 80. `r3f/shaderPatch/lightLoopEdits.test.ts`
   counts them and fails past 80.
3. A feature must change the structure of the light loop, not lines inside it. Examples are
   Godot's per-mesh light limits and light cull masks.

The lit-surface port is a set of TSL node materials. They draw on `WebGLRenderer` through three's
`WebGLNodesHandler`, and the same nodes draw on `WebGPURenderer` later. A `ShaderMaterial` does not
run on the WebGPU backend, so a port in that form would be done a second time.
[`docs/webgpu-tsl-spike.md`](../webgpu-tsl-spike.md) holds the measurements.

The port owns Godot's lighting model, a light node and a shadow node for each light kind, and the
surface inputs. It removes the light and shadow anchors, which cost the most at an upgrade.

On 2026-11-11 the owner started the port without a trigger, because the edits stand at 78 of 80.
While the port runs:

- The node lit surface stays behind one switch. With the switch off, every golden stays
  pixel-identical.
- The triggers and the limit of 80 stay. A change to the lit surface lands in the node graph, not in
  a new patch.
- A golden may move by at most 1/255 when a material switches to nodes, and only if its comparison
  with Godot does not get worse.
- The webview bundle ceiling is 1,150,000 B. The pull request that removes the patches measures the
  bundle and proposes the next ceiling.

## Consequences

The anchor test does not catch three changing code next to an anchor that it keeps. The goldens
catch that. The port has its own issues. It is not a change inside another pull request.
