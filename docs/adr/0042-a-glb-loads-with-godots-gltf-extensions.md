# A GLB loads with Godot's glTF extensions

- Status: Accepted.
- Related: ADR-0031 (resource slices: the GLB slice is a foreign-format slice whose parser
  is three's `GLTFLoader`), ADR-0028 (import sidecars: the other place Godot's importer
  changes what a model looks like).

## Context

Godot never renders a `.glb` or `.gltf` directly. Its importer reads the file once and a
scene instances the result. That importer reads only the extensions in
`get_supported_gltf_extensions_hashset` (`modules/gltf/gltf_document.cpp:6787-6806` in
4.6.3): eight that `GLTFDocument` reads itself, and five from the extension classes
`register_types.cpp:133-136` registers. For any other extension it does one of two things:

- an optional one is skipped, so the model imports as if the extension were absent;
- a required one refuses the whole file (`gltf_document.cpp:7197-7202`).

three's `GLTFLoader` reads a different set. It reads extensions Godot skips, such as
`EXT_mesh_gpu_instancing` (one mesh drawn once per instance) and the material extensions
`KHR_materials_clearcoat`, `_sheen`, `_transmission` and others. It only warns about a
required extension it does not know. Without a decision the previewer shows a forest where
Godot shows one tree, and a clearcoat Godot never draws.

## Decision

**A GLB loads with the extensions Godot's importer reads, by default.** The GLB slice
applies Godot's rules before three reads the file (`formats/glb/extensionRules.ts`):

- a required extension outside Godot's set refuses the file, which shows the
  missing-resource placeholder;
- every other extension outside that set is removed from the file's JSON, so three's
  plugin for it finds nothing to read. `extras` is the author's data and stays as written.

Godot's set lives in `godot/gltf.ts`, beside the rest of the engine facts.

The rules are one switch, `GltfExtensionRules`, a `ResourceLoader` option
(`gltfExtensions`) and so a `createResourcePipeline` option. `godot-importer` is the
default. `three-loader` loads every extension three reads, for a host that wants the
richer picture. No host exposes the switch yet.

## Consequences

- A model looks as it does in Godot, including where Godot ignores something the file
  asks for.
- A file whose optional `KHR_draco_mesh_compression` Godot skips still fails here. three
  constructs its Draco handler from `extensionsUsed` before any plugin runs, and this
  previewer ships no Draco decoder, so both rules refuse it.
- Upgrading three cannot widen what a model shows under `godot-importer`: the filter
  names what Godot reads, not what three reads.
