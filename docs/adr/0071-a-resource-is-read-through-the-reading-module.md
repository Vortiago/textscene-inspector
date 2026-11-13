# A resource is read through the reading module

- Status: Accepted
- Amends: ADR-0031 (the input of a Godot-text decode).
- Related: ADR-0046 (sub-resource paths), ADR-0051 (an override resolves in the file that wrote
  it), ADR-0060 (a scene pass on the live tree).

## Context

Godot turns `SubResource("id")` and `ExtResource("id")` into an object while it parses
(`scene/resources/resource_format_text.cpp:104-114`, `:142-147`), so a setter gets a
`Ref<Resource>` whatever the origin (`scene/resources/packed_scene.cpp:381`). Here the value stays
text, and each reader resolved it. A reader that handled one origin drew nothing for the other: a
Path3D whose Curve3D is in a `.tres` drew no curve. The request, the pin and the **Missing
resource** report had one copy for each kind of caller.

## Decision

**A reader names a reference and a kind, and `resources/reading/` answers.** The answer is
`loaded` with the value, `none` (the property holds no resource), `pending` (a file has not
arrived) or `unavailable` with a reason.

- **Resolve on read, not at load.** The parse result does not change. The module resolves a
  reference when a reader asks, so a reader moves onto the module alone. Godot's model stays open
  for later: once no reader holds a table, the module can resolve at load with no change to a
  reader.
- **The tables are hidden.** A decode gets a held resource (its class, its property strings, its
  address and how it is held) and `Follow`, which reads a nested reference in the holder's tables.
  A decode cannot look a reference up for one origin only.
- **No raw kind.** The module exports no kind that hands out the resolved resource itself. A
  reader moves once, with the kind of its resource.
- **No port for the loader.** The one inner seam is "what does the loader hold at this file". Its
  two adapters are the loader's cache and a fixed map of files (`staticSnapshot`). A test reads
  through the real `ResourceLoader` over a map of files, or through `staticSnapshot`.
- **A host owns the request, the pin and the report.** A reader does none of these. A host runs a
  reader again only when a file one of its reads touched loads, fails or reloads. Each host passes
  `describeSnapshotHost`.
- **The decode cache compares strings.** A built-in resource keeps its value while its class, its
  strings, its holding and each nested answer stay the same, across a new parse of the scene. A
  file resource keeps its value until its file reloads.
- **A source scan holds the line** (`scripts/resourceLookups.test.mjs`). Outside the module, a
  production file under `nodes/`, `r3f/` or `resources/` calls no lookup of a reference. Its list
  of files not moved yet only shrinks, names the issue that removes each entry, and ends.

## Consequences

- A reader of a new resource writes `useNodeResource(properties.x, KIND)` and draws the same from
  a scene and from a file.
- A decode that hands on a reference with `Follow.reference` gets a new value when the holder's
  tables are a new object, because the reference holds them.
- An image file the loader imports reads as a held resource of the class `IMPORTED_FILE`, with
  the file as its address. `TEXTURE_2D` and `TEXTURE_3D` decode it to the path, and the texture
  hook loads the pixels. So a resource file is legal at every position of a Texture2D chain.
- A read of a value that a loader processor builds (a font, an ArrayMesh, pixels) is not part of
  the module yet. It lands with its first kind.
