# Shader patches stay until a trigger says port

- Status: Accepted
- Related: ADR-0038 (one owner for every program input), ADR-0039.

## Context

The renderer draws Godot's lit surface by splicing Godot's GLSL into three's built-in shader chunks
and programs at string anchors. On 22 October 2026 that was about 125 anchors at 44 sites in 37
modules, and about 1,000 lines of injected GLSL. On 7 October it was 27 anchors at 11 sites.

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
2. The edits to the light and shadow chunks pass 80. They were 62 on 23 October, counted as every
   anchor that `applyEdit` matches in a `lights_*`, `shadowmap_*`, `shadowmask_*` or
   `envmap_physical_pars_fragment` chunk while `programInjections.test.ts` runs.
3. A feature must change the structure of the light loop, not lines inside it. Examples are
   Godot's per-mesh light limits and light cull masks.

The lit-surface port is one `ShaderMaterial` per shading mode. It owns Godot's light functions and
light loop, and includes three's chunks for skinning, morph targets, instancing, clipping and fog.
It removes the light and shadow anchors, which cost the most at an upgrade.

## Consequences

The anchor test does not catch three changing code next to an anchor that it keeps. The goldens
catch that. A trigger starts its own issue for the port, not a change inside another pull request.
