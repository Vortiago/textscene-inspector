# A shader uniform reaches the GPU as its bits

- Status: Accepted.
- Related: ADR-0072 (Godot's shaders are one module that imports only three), ADR-0076 (Godot's shaders run through one transpiler).

## Context

Godot fills a material's uniform buffer with the bits of each lane (`material_storage.cpp:741`). An int, uint or bool lane holds an integer, and a float lane can hold any NaN.

three r187 copies the uniforms of a node material into a uniform buffer through `WebGLUniformsGroups`. It writes an int, uint or bool lane of its own `uniform` nodes as a float, and it copies the `Uint32Array` of a `uniformArray` of `uvec4` as floats too (`WebGLUniformsGroups.js:307`). Only a `Float32Array` value is copied byte for byte, because a typed array copy between two arrays of one type copies bytes.

## Decision

**Every uniform of a translated shader is one `uniformArray` of `uvec4` slots, one slot per column, as std140 lays an element out. The slots hold the lanes' bits in a `Float32Array`, and the shader reads each lane back from its bits.**

- A single value is an array of one element.
- A float lane is read with `uintBitsToFloat`, an int lane with `int`, and a bool lane as bits that are not 0.
- The port lives in `shaders/uniforms/uniformNodes.ts`.

## Consequences

- A shader reads the same bits Godot writes, a NaN payload and a `uint` above 2^24 included.
- Each uniform costs a 16-byte slot per column and a conversion per read.
- The decision depends on how three copies a uniform buffer. The uniform probes of `pnpm test:shaders:gpu`, which CI runs on every pull request, fail when that copy changes: the int, uint and bool probes and the NaN array probe read wrong bits.
- WebGPU copies uniform buffers another way and is untested (#1788).
