# TextScene Inspector

This glossary names the project's own concepts for parsing Godot text-scene (`.tscn`) files and rendering them with react-three-fiber. It holds no general programming terms.

## Language

### Format & parsing

**TSCN**:
Godot's text scene file format: a sequence of `[heading key=value]` sections of the kinds `node`, `ext_resource` and `sub_resource`.
_Avoid_: "scene file", "godot file".

**Node**:
One entry in a scene tree, with a `type`, `name`, parent path, `properties`, optional `instance` reference and `children`, which the parser emits as `TscnNode`.
_Avoid_: "element", "entity".

**SceneGraph** (`core/SceneGraph.ts`):
The parsed tree of Nodes for one authored root scene, built at parse time and read from `HierarchyContext`.
_Avoid_: "scene tree" for the data structure (it names the UI panel, `SceneTreeViewer`).

**Live scene tree** (`r3f/liveSceneTree.ts`):
The runtime tree the user navigates: the **SceneGraph** roots with **PackedScene instancing** folded in and **GLBSceneRoot** internals descended, in one node-path space.
Every consumer that renders a subtree descends this tree, because a **SceneGraph** child list shows an instance as a childless node.
_Avoid_: **SceneGraph** or "scene tree" for this tree.

**Live step** (`LiveStep` in `r3f/liveSceneTree.ts`, from `LiveTree.stepOf`):
One node of the **Live scene tree** as a reader needs it: the node as shown, the **Authored scope** its refs resolve in, and the child groups below it.
A reader takes all three from the one call, because the authored node and its group's scope are the wrong ones for an instance root and for a grafted node.
_Avoid_: reading a node's merge, scope or children in separate calls.

**Live tree snapshot** (`LiveTreeContext` in `r3f/liveSceneTree.ts`, shared by `useSharedLiveTree`):
One read of the loader's scene cache that every question over the **Live scene tree** shares until the next scene or GLB load.
It reads each scene path once, composes each inherited sub-scene once, and holds the one tree and owner walk that every path question asks.
_Avoid_: a live tree or a context per consumer, per question.

**Authored scope** (`LiveNode.scope`, read through `scopeOf` and `LiveTree.stepOf`):
The resource pools of the file that wrote a node. A host node grafted into an instanced sub-scene keeps the host's, so its ids resolve there although both files number their resources from 1.
Every reader of the **Live scene tree** resolves a node's refs in its **Authored scope**, never in the pools of the group the node sits in.
_Avoid_: resolving a grafted node's ids in the sub-scene's pools.

**Live scene pass** (`LiveScenePass`, `r3f/liveScenePass.ts`, ADR-0060):
A scene pass that reads the whole **Live scene tree** and answers per live node path, so a NodePath binds across an instance border as Godot's `get_node_or_null` does.
A component reads its result by its own node path, because the nodes of a sub-scene are shared by every instance of it.
_Avoid_: writing a pass's result into a node. A parse-time pass for a path that may cross an instance.

**Instance name table** (`resources/instanceNameTable.ts`):
An instance root's `%Name` table, which the merge composes as instantiate builds it: the sub-scene's own names, then each host `unique_name_in_owner` setting at its heading, in file order.
The merged node keeps it, and the render path's per-owner tables read it. A `%Name` that the table lacks at the instance root reads the table of the instance's owner next, which the file above answers.
_Avoid_: a second composer of an instance's table.

**ExtResource**:
An external file reference, written `ExtResource("id")` and declared by an `[ext_resource]` heading with a `uid=` and a `path="res://…"`.
_Avoid_: "asset", "import".

**Import sidecar**:
The `.import` file Godot writes beside a source asset to record its importer and parameters.
No scene references it, so a missing one is an ordinary outcome and not a **Missing resource**.
_Avoid_: "import file" for the asset itself.

**Imported mip chain** (`resources/processing/mipChain.ts`):
The levels Godot's texture importer builds on the CPU for an image whose **Import sidecar** sets `mipmaps/generate`: each level averages the bytes of the one above, renormalised for a normal map.
The texture carries them as its own levels, so the GPU builds no chain over them.
_Avoid_: "mipmaps" for a chain the GPU generates.

**Noise mip chain** (`resources/textures/noisetexture2d/pixels.ts`):
The **Imported mip chain** of a NoiseTexture2D whose `generate_mipmaps` is on, built in the worker job beside the pixels. No level is renormalised.

**Stored mip chain** (`resources/textures/image/decode.ts`):
The levels below the top one that a saved `Image` holds in its bytes when its `mipmaps` is on, down to 1 × 1.
The texture uploads them as saved and builds none, so a level that is not the average of the one above draws as saved.
_Avoid_: **Imported mip chain** for a saved `Image`, whose levels no importer built.

**Roughness limiter** (`resources/processing/roughnessLimit.ts`):
The pass Godot's texture importer runs on a roughness map's **Imported mip chain** when its **Import sidecar** names a normal map: each level's roughness rises by the spread of the normals it covers.
_Avoid_: the bare name for the **Screen-space roughness limiter**.

**Screen-space roughness limiter** (`r3f/godotLightFunction.ts`):
The shader step that raises a pixel's roughness by how far its normal differs from the normal of its pixel pair.
Godot takes a fine derivative. WebGL 2 has none, so a pixel with a normal map reads the map one texel along its pair.

**Texture view** (`resources/textures/textureView.ts`):
The texture a consumer samples: a shared source with the sampler state the consumer states laid over it.
It is the source itself when the source already samples that way, and one clone that the consumer owns when it does not.
_Avoid_: "texture clone", which names how a view is made, not what it is.

**Mipmap bias** (`r3f/materials/godotMipmapBias.ts`):
The offset a viewport adds to the mip level that each of its 3D material samplers picks: the project's `texture_mipmap_bias`, or a SubViewport's own.
It changes only a texture that has levels to choose between.
_Avoid_: "LOD bias", which suggests mesh level of detail.

**Anisotropic filtering level** (`r3f/contexts/AnisotropicFilteringContext.tsx`):
The `Viewport.AnisotropicFiltering` value, 0 to 4, that sets `1 << level` taps for a texture on an anisotropic `texture_filter`: the project's `anisotropic_filtering_level`, or a SubViewport's own for the textures that only its pass draws.
Unlike the **Mipmap bias**, the texture carries it, so it cannot change between passes.

**Unwrap cache**:
The `.unwrap_cache` file Godot's importer writes beside a source asset it unwraps for lightmaps: each mesh's UV2 layout, keyed by the MD5 of the mesh as the unwrap received it.
Like an **Import sidecar**, no scene references it, and a missing one is an ordinary outcome.
_Avoid_: "lightmap cache", which suggests the baked lightmap.

**Lightmap atlas** (`resources/lightmapgidata/build.ts`):
Every layer of a bake's lightmap textures, stacked in order into one texture array. A surface reads its own slice of it through UV2.
_Avoid_: "lightmap texture" for the whole stack: a bake can save several.

**Shadowmask** (`r3f/lightmap/lightmapProgram.ts`):
The second atlas a bake saves, one byte per texel: how much of a sun's light reaches that texel. A LightmapGI's shadowmask mode sets how it meets the sun's real-time shadow. Replace puts it in the place of the real-time shadow where that fades out, Overlay multiplies it with the real-time shadow, and Only uses it alone.
_Avoid_: "shadow map", which is the real-time depth map of a light.

**Lightmap assignment** (`r3f/lightmap/sceneLightmaps.ts`):
The LightmapGI a node takes its light from, with the node's entry in that bake: its UV scale and slice. It is the last LightmapGI in ready order whose data names the node (ADR-0054).

**Project settings**:
`project.godot` at a project's `res://` root, read under the names `ProjectSettings.get_setting()` uses.
Only settings the previewer honours get a typed reader, and a scene without the file renders at Godot's defaults.
_Avoid_: "config file" for a `.tscn`. A general settings store.

**Project default font** (`resources/fonts/font/projectFonts.ts`):
The font that the **Project settings** name in `gui/theme/custom_font`. A font lookup that no theme answers ends at it, before the bundled Open Sans. A path that does not load keeps the bundled font and is a **Missing resource**.
_Avoid_: "custom font", which a node's `theme_override_fonts` also is. "fallback font" for the bundled one.

**Project fonts** (`resources/fonts/font/projectFonts.ts`):
The two files the **Project settings** name for every font lookup: the project theme (`gui/theme/custom`) and the **Project default font**. The Control solve tree, TextMesh and Label3D each resolve them from one source.
_Avoid_: "theme context", which Godot's `ThemeContext` also names.

**Style face** (`nodes/2d/ui/richtextlabel/styleFaces.ts`):
The font a RichTextLabel draws a `[b]`, `[i]` or `[b][i]` span in: the theme's `bold_font`, `italics_font` or `bold_italics_font`. Where no theme sets the key, it is a `FontVariation` over the **Project default font** with embolden 1.2, skew 0.2, or both.
_Avoid_: "synthetic bold" for a face a theme sets.

**Asset re-import**:
What the previewer does in place of Godot's import pipeline: it loads the source asset (`.gltf`, `.glb`, `.obj`) and re-derives the scene from it.
ADR-0028 holds the decision and the allowlist of **Import sidecar** parameters it honours.
_Avoid_: "Godot's importer" for this.

**SubResource**:
An embedded resource, written `SubResource("id")` and declared by a `[sub_resource]` heading in the scene's internal-resources list.
_Avoid_: "asset", "inline resource".

**Sub-resource path** (`resources/subResourcePath.ts`):
`res://file.tres::SubId`: Godot's notation for a **SubResource** of a `.tres` other than the previewed scene (ADR-0046).
The whole address is the resource identity, and only its `filePath` half reaches the byte layer, because only real files can be fetched.
_Avoid_: "composite path", "synthetic path". A `fetch` of the whole address.

**Resource section** (`resources/resourceSection.ts`):
The part of a parsed `.tres` that a path addresses: the `[resource]` body for a plain path, or the named `[sub_resource]` for a **Sub-resource path**.
_Avoid_: "the resource" or "the body" for a `[sub_resource]`.

**ParsedResource** (`parser/parsedResource.ts`):
The one parsed form every Godot resource serialisation normalises to: the header type, the resource tables and the `[resource]` body as raw value strings.
The slice's `decode.ts` owns what the values mean.
_Avoid_: decoding values at parse time.

**UID reference**:
Godot 4's stable `uid://…` identifier, which the previewer ignores because every ExtResource here pairs it with an authoritative `res://` path.
_Avoid_: "id".

**Lenient parser** (`TscnParser`):
The recovering parser for rendering, which logs issues, emits what it can and keeps unknown Node types.
_Avoid_: "the parser".

**Strict parser** (`StrictTscnParser`):
The validating parser for linting, which reports every syntax and format error as a `ParseError` with line and column through a **ParseObserver**.
_Avoid_: "validator".

**ParseObserver** (`parser/TscnParserCore.ts`):
The optional hook **seam** (`onError`, `onSectionStart`, `onProperty`, `onSectionBuilt`) on the one shared scanning loop.
The lenient parser passes none, and the strict parser passes one that collects errors and runs validators.
_Avoid_: "callback API", "strict mode flag".

**Seating** (`seatScene` in `parser/sceneTreeBuilder.ts`):
The scene tree the `[node]` headings form once each sits under the node its `parent=` names, in declaration order as instantiate places them, every owner's `%Name` claims and releases in file order, and the one walk that resolves a root-relative node path over it.
Both parsers seat through it, the linter and the **Language-feature engine** read the node each heading sits under (`seatedParents`) for `parent=` and resolve every **Connection end** through its walk, and every `%Name` reader, the instance graft included, reads its claims.
_Avoid_: a second path table or `%Name` claim table over the headings.

**Connection end** (`connectionEndResolver` in `parser/connectionEnd.ts`):
The `from=` or `to=` of a `[connection]` heading, and the node it names: the node its simplified path walks to in the **Seating**, else the heading its `from_uid_path=` or `to_uid_path=` lands on.
The linter and the **Language-feature engine** both resolve an end through the one resolver.
_Avoid_: resolving an end by path alone in one reader and with the id trail in another.

**Value decoder** (`parser/valueParsers.ts`):
The lenient parser's shared primitives (`intOr`, `floatOr`, `parseOptionalFloat` and the others) that read a raw property string into a typed scalar or vector.
The grammar is shared, but the absent/error contract may **fork** per slice.
_Avoid_: per-node `intOr` or `floatOr` copies. "validator". `FLOAT_PATTERN_SOURCE` in a validator (it refuses `inf` and `nan`, which Godot writes).

### Linting

**Diagnostic**:
One linter finding: a **Severity**, a message, the node, the name of the check and usually a line and column.
A finding with no line is about the whole file.
_Avoid_: "error" for a diagnostic of unknown severity, "issue".

**Validator** (format check):
A per-property format or range check that judges one property's value alone during strict parsing and inherits down the node base-type chain.
Its **Severity** comes from what the engine does (`linter/validators/v/grounding.ts`), and its **Diagnostic** is named `format:<property>`, with the key as the file writes it.
_Avoid_: "validator" for a **Value decoder**.

**Format-only validator**:
A **Validator** marked `formatOnly`, which cites nothing because it refuses only unreadable text or a whole value of a type the slot does not convert.
The `formatOnlyCorpus` ledger checks that it never errors on a literal Godot stores.
_Avoid_: `formatOnly` on a refusal of a value the setter receives.

**Lint rule** (semantic check):
A per-node-type check on the parsed scene for a condition no single property settles, matched to its exact node type with no base-type inheritance.
_Avoid_: bare "rule" for a **Validator**.

**Resource rule** (`linter/ResourceRuleRegistry.ts`):
A per-resource-type check on one `[sub_resource]` or `.tres` body, for a condition Godot reports when it loads that resource, whatever holds it. It reports once per section, on the line of the property it names, and declares its **Rule arm**s in `emits` as a **Lint rule** does.
_Avoid_: a **Lint rule** on each node that holds the resource.

**Raw view** (`RawNode`, `RawScene` in `parser/types.ts`):
A node or scene with `rawProperties` and no `properties`, which is what a **Lint rule** receives. Both parsers publish the same `rawProperties`, so a helper typed on the view reads the same values from either tree.
_Avoid_: reading `properties` in a rule, or casting it to a string map.

**Heading facts** (`HeadingFacts` in `parser/types.ts`):
What the `[node]` and `[connection]` headings state that the scene tree does not hold: orphaned nodes, a root with a `parent=`, `parent=""` headings, each connection heading, the **Connection end** resolver over them and instances outside a node body.
Only the linter reads them, so only the strict parser's `StrictScene` carries them. The strict parser builds them from the headings the core returns beside the scene and from its own observer.
_Avoid_: putting a linter-only field on `TscnScene`.

**Re-rooted node** (`reRoot` in `parser/sceneTreeBuilder.ts` and in `resources/seatEscaped.ts`):
A node whose `parent=` path names nothing and which Godot moves under the scene root, renamed `<path>#<name>`. The tree builder does the same on a copy of the heading's node, which keeps the heading's name in `authoredName`. A path through an instance is walked by the live tree, where the instance's graft hands the node back and the file that wrote it re-roots it.
A node below it re-roots on its own, since the old path no longer exists. Godot does not re-root in a scene it refuses to instantiate, nor where a `parent_id_path=` lands the node.
_Avoid_: "dropped node", which names a node left out of the tree.

**Landed node** (`seatLanded` in `parser/sceneTreeBuilder.ts`):
A node whose `parent=` path names nothing and whose `parent_id_path=` finds a heading of this file or a node in the content of an instance. Godot seats it under that node and keeps its name (`packed_scene.cpp:161-163`).
The **Seating** does the same, and still counts the node among the orphans, since it is not at the path it declares.
_Avoid_: "re-rooted node" for a node that keeps its name.

**Content trail** (`followContentTrail` in `godot/scene/packedScene.ts`):
The ids of an `owner_uid_path=` or `parent_id_path=` that follow the id of an instance heading. The trail continues in that instance's scene, and in its base scene where its own headings lack the id (`packed_scene.cpp:1947-2005`).
The **Seating** seats the node under the instance heading with the rest of the trail, and the instance's graft follows it over the cached scene. A trail that finds nothing there re-roots the node and gives it no owner. A `parent=` or `owner=` walk that enters an instance and finds nothing takes the trail the same way.
_Avoid_: resolving the ids of a trail against the headings of one file alone.

**Rule arm** (`linter/ruleArms.ts`):
One diagnostic a **Lint rule** or a **Resource rule** can report, declared with its rule name, its **Severity** and the `EmitGrounding` that fixes that severity.
A rule reports only through its arms (`reportArm`, `armDiagnostic`), and `armEmits` derives its `emits` from them.
_Avoid_: a hand-written diagnostic object in a rule.

**Indexed family** (`IndexedFamily` in `godot/classdb/indexedFamily.ts`):
The `PropertyListHelper` array a class serialises as `<prefix><N>/<leaf>`, declared once with its prefix, index parse, count key, leaves and out-of-bounds policy. The family validator, the past-count **Lint rule** and the parser grouping all derive from that declaration.
_Avoid_: restating a prefix, a count key or a policy beside a validator or a rule.

**Range advisory** (`linter/rangeAdvisory.ts`):
A warning **Lint rule** that the shared `rangeAdvisories` combinator emits when one numeric property falls outside a table of cited thresholds.
_Avoid_: a range advisory that errors. A cross-field check as a range advisory.

**Severity**:
One of three levels, fixed by what the engine does with the value (ADR-0032, `severityFixedBy`), never chosen per rule.
An **error** means Godot refuses or alters the value or cannot load the file, or a rule threw. Only an error fails the CLI and CI.
A **warning** means the value is legal but suspect: Godot's editor warns about it, it sits outside the property's editor hint, or the claim is about the file.
An **info** means the engine reads the value and leaves it inert (`engine-inert`), or the finding is about this previewer rather than the scene.
_Avoid_: advisory conditions as errors. Severity as presentation.

**Live lint, settled render**:
The cross-host contract that every lint surface describes the text as typed, while the rendered scene follows committed text.
_Avoid_: gating lint on a clean parse. Rendering the raw mid-edit buffer.

**Instance-opaque linting**:
The rule that existence checks never look inside an instanced sub-scene, so a reference across an `instance=` boundary stays silent.
_Avoid_: resolving instance internals in the linter.

**Viewport scope**:
The nearest Viewport ancestor of a node, or null for the scene's own viewport, which bounds per-viewport state such as the current-camera slot.
An ancestor of unknown type puts the node in no scope.
_Avoid_: a per-viewport rule scoped to the whole scene.

### Language features

**Language-feature engine** (`languageFeatures/`):
The React- and THREE-free core area that answers editor requests for one `.tscn`: hover, completion, quick fixes, folding, document highlights and the references of a `res://` path.
It reads the text through a **ParseObserver** on the scanning loop, seats the `[node]` headings through the **Seating**, and reads the `godot/` captures.
Every result is host-neutral with zero-based ranges, so the VS Code extension and the `tscn-lsp` server share it (ADR-0049).
_Avoid_: "LSP" for the engine. LSP names the protocol, which the `tscn-lsp` server speaks. "Language service".

**Res root** (`resources/resRoots.ts`):
The directory a scene's `res://` paths resolve under: the nearest `project.godot` above the scene, else the scene's own directory when it lies inside the workspace, else none.
A scene with the second kind is a loose scene, and Godot has no `res://` for it.
_Avoid_: "project root" for the second kind.

**Agent tool**:
A tool the VS Code extension registers through `vscode.lm` for a coding agent in chat.
The agent tools lint a scene, read its node tree, open or capture its preview, and list its missing resources.
_Avoid_: "action" for an agent tool.

### Code organisation

**Vertical slice**:
All code for one Node type in one folder: parser, linter, formatter, render component and tests.
_Avoid_: "module", "feature folder".

**Resource slice**:
All code for one resource type in `resources/<category>/<type>/`, the resource-side sibling of the **Vertical slice** (ADR-0031).
A Godot-text slice splits a pure `decode.ts` from `build.ts`, and a foreign-format slice declares its real parser instead.
_Avoid_: "processor" for the slice. A hollow `decode.ts` on a foreign format.

**Godot surface**:
One triangle surface in Godot's mesh arrays: positions, normals, tangents, UV and UV2, with front faces clockwise and V from the image top.
A decoded ArrayMesh, a PrimitiveMesh builder and a CSGMesh3D brush share it, and `godotSurfacesGeometry` alone turns it into three's winding and V.
A PointMesh builds the one surface that is not triangles: a single position with no indices, flagged `isPoints`, which three draws as `THREE.Points`.
_Avoid_: "three-space surface". "mesh data".

**React-free linter boundary**:
The invariant that the linter bundle never imports React or THREE, even transitively, which a **conformance guard** checks on the import graph.
_Avoid_: "linter isolation".

**Slice entry points**:
The three thin registration files per slice: `index.ts` (parser and formatter), `index.linter.ts` (validators and lint rules, `.ts` only) and `index.r3f.ts` (the only importer of `./Component`).
_Avoid_: "barrel" (it names `parser/TscnParser.ts`, `r3f/nodes/index.ts`, `linter/index.ts` and `resources/sliceRegistrations.ts`).

**NodeRegistry**:
The parser-domain singleton that maps `typeName` to `{parser, propertyFormatter}`, filled by side-effect imports in `TscnParser.ts`.
_Avoid_: "parser registry".

**NodeComponentRegistry**:
The render-domain singleton that maps `typeName` to a React component, which `NodeDispatcher` consults before it falls back to `GenericNodeFallback`.
_Avoid_: "renderer registry".

**ControlComponentRegistry**:
The 2D-UI analogue of NodeComponentRegistry, which maps a Control `typeName` to a native canvas painter and falls back to the outline `ControlFallback`.
_Avoid_: "UI registry", "DOM component".

**Seam**:
The place where a module's interface lives, so behaviour can change behind it without an edit to the callers.
Two adapters make a seam real, and one makes it hypothetical.
_Avoid_: "boundary". A seam nothing varies across.

**Depth**:
How much behaviour a caller or test can exercise per unit of interface it must learn.
_Avoid_: bare "depth" for a dependency-chain distance or a test suite's size.

**Conformance guard**:
A test that walks a registry or scrapes source to prove every registered thing has its promised shape (`barrelCompleteness`, `parserBarrelCompleteness`, `resourceSliceConformance`, `baseChainCompleteness`, `reactFree`, `noDependencies`, `engineFactRoutes`, `packageExports`).
Its failure list is the work list, and a green guard proves only what it scraped.
_Avoid_: a per-slice test as a substitute. "coverage" for a guard.

### Rendering

**NodeDispatcher**:
The recursive walker that turns SceneGraph root Nodes into a react-three-fiber tree, with each Node in a pickable `<group>`.
_Avoid_: "renderer".

**ControlCanvasWalker** (`r3f/controls/native/ControlCanvasWalker.tsx`):
The native analogue of NodeDispatcher for Controls: it runs the **Control rect solve** and emits one named `<group>` per Control at its solved rect (ADR-0037).
A painter draws only its node's own chrome, and children render as solved siblings, never as its React children.
_Avoid_: "UI renderer", "ControlDispatcher".

**Control rect solve** (`r3f/controls/native/controlRectSolver.ts`):
The two-phase pass that computes every Control's `Rect2` before anything paints: minimum sizes bottom-up, then placement top-down.
It is a line-by-line port of Godot 4.6.3's `scene/gui/control.cpp` (ADR-0037).
_Avoid_: "layout solve".

**Painter view** (`r3f/controls/native/solveTree.ts`'s `painterView`/`PainterView`):
The node properties a native Control painter may see: all except `modulate` and `selfModulate`, which **ControlCanvasWalker** has already applied.
`painterViewConformance.test.ts` forbids a painter to read them from `solveNode.node.properties`.
_Avoid_: "the painter's props" for this.

**Solve handoff** (`r3f/controls/native/solveHandoff.ts`):
What a Control's solver computes and hands to its painter, so neither computes it twice.
A **share** reads only the node and `theme` and is memoised per `(SolveNode, theme)`, and a **channel** is solve output sealed by a `ContainerLayoutFn`.
_Avoid_: "meta" for either form. "cache" for a share.

**Canvas paint order** (`r3f/canvasPaintOrder.ts`):
Where a canvas item draws in the 2D canvas, as Godot decides it: `(canvas layer, z_final, draw sequence)` in that precedence, whatever the node type (ADR-0036).
_Avoid_: "z order", "z offset".

**Draw sequence**:
An item's position in Godot's single pre-order walk of the canvas, the third and weakest term of **canvas paint order**.
_Avoid_: "paint index".

**Canvas frame** (`Canvas2DStage/canvasFrame.ts`):
The render target a 2D canvas draws into, the root's or a SubViewport's. It is y-down like Godot's, and it copies to the target bound before it with its rows reversed. It has one sample, or the `msaa_2d` count (ADR-0057).
_Avoid_: "MSAA frame".

**Rendering quadrant** (`resources/tileset/renderingQuadrants.ts`):
The cells of a tile layer that Godot draws together: a `rendering_quadrant_size` square of cells, or one tile row on a y-sorted layer (`tile_map_layer.cpp:546-554`).
_Avoid_: "chunk", "tile batch".

**Tile canvas item** (`resources/tileset/tileCanvasItems.ts`):
One canvas item of a **rendering quadrant**: a run of its cells that share a tile material and `z_index`, with its own light list and z.
_Avoid_: "quadrant" for this, "sub-quadrant".

**Drawable cell** (`resources/tileset/drawableCell.ts`):
A placed tile cell whose atlas source, tile and alternative tile all exist, so Godot draws it (`tile_map_layer.cpp:527-531`).
_Avoid_: "valid cell".

**Viewport mode**:
The single `'2D' | '3D'` display state of the centre viewport: `3D` mounts the R3F canvas, and `2D` mounts the pannable 2D stage.
A heuristic on the scene root type picks the default, and the toolbar toggle overrides it.
_Avoid_: "2D mode" alone.

**Frame profile** (`r3f/frameProfile/`):
The measurement of every frame on one renderer while the Performance toggle is on: frame rate, frame interval, and the CPU time, GPU time and draw calls of each **render step**, averaged over half a second (ADR-0053).
_Avoid_: "profiler" for the overlay. "stats" for the timing itself.

**Render step**:
A named part of a frame that a **frame profile** times, such as Shadows or Fog. Its time and draw calls are its own: a step nested in it keeps its own.
_Avoid_: "pass" (a pass is one render, and a step can hold many). "phase".

**Work budget**:
The draw calls per frame, and the runs and draw calls of each **render step** per frame, that a budget scene may reach in `scripts/perf/budgets.json`. `pnpm test:perf` fails on a scene over its budget (ADR-0053).
_Avoid_: "performance budget" (it holds counts, not times). "baseline" (a golden's image).

**Sub-viewport**:
Godot's `SubViewport` Node, a canvas boundary but not a world boundary: it owns its World2D and shares the parent's World3D unless `own_world_3d` is set (ADR-0033).
_Avoid_: bare "viewport" or the unhyphenated "subviewport" for the Godot node. "offscreen subtree".

**Viewport surface**:
What displays a **sub-viewport**'s render target (a `SubViewportContainer` or a `ViewportTexture` consumer), and the one place its canvas subtree is dispatched.
_Avoid_: "viewport container" for the concept. "render target" for the surface.

**ViewportTextureRegistry**:
The `nodePath → { texture, size }` lookup that a **sub-viewport** publishes its render target into and every **viewport surface** resolves against.

**Light pass host** (`r3f/lighting2d/lightPassHost.ts`):
The scene, camera, buffer size and clip rect that one `CanvasLightPass` accumulates and shades through, and the call that runs it. The 2D stage and each **sub-viewport** with 2D content are hosts, and each one's lights, occluders and CanvasModulate act on its own items alone (ADR-0033).

**ViewportPassRegistry**:
The pass-ordering half of the same seam (`ViewportPassRegistryContext.tsx`): one `<ViewportPassOrchestrator>` per canvas runs every registered sub-viewport pass in dependency order each frame.
A pass in a dependency cycle never runs, and `useViewportPassCycle` lets a consumer fall back.
_Avoid_: treating it as a resource cache.

**layout_mode**:
The Godot Control property that records how a node is positioned: `0` free, `1` anchors, `2` container-managed.
The **Control rect solve** leaves it unread and treats a Control as container-managed when its parent has a registered `ContainerLayoutFn`.
_Avoid_: saying the solve branches on `layout_mode`.

**Anchor / offset**:
The Godot Control layout properties (`anchors_preset`, `anchor_*`, `offset_*`, `grow_*`) that place a Control whose parent has no registered `ContainerLayoutFn`.
_Avoid_: "margin". CSS `calc()` or absolute-positioning language.

**StyleBox**:
A Godot Control theme resource (`StyleBoxFlat` or `StyleBoxEmpty`) for background, border and corner radius, drawn as a vertex-coloured mesh ported from `StyleBoxFlat::draw`.
_Avoid_: "style". CSS `background`, `border` or `border-radius` language.

**Program input** (`r3f/materialProgramInputs.ts`):
A material prop that decides which shader program a material draws with, so a change to it remounts the material (ADR-0038, ADR-0039).
A **uniform**, such as a colour, changes freely and stays out of the remount key.
_Avoid_: bare "key". "recompile" for a React remount.

**Collision-shape resource**:
A `[sub_resource]` that carries collision geometry (`BoxShape3D`, `ConvexPolygonShape3D`, `ConcavePolygonShape3D`), referenced by a **CollisionShape3D** Node through `shape`.
_Avoid_: "collision mesh".

**Collision gizmo**:
An optional wireframe of a CollisionShape3D's collision-shape resource in the 3D viewport, off by default and driven by `showCollisions`.
_Avoid_: "debug shape".

**Node icon** (`r3f/nodeIcon/`):
Godot's billboard icon at the origin of a node, at a fixed size on screen. A node type declares it through `editorIcon` in its registration. It follows the Gizmos toggle and is faint while the node is unselected (ADR-0056).
_Avoid_: "sprite", "label".

**CSG root**:
The `CSGShape3D` whose direct parent is not a `CSGShape3D`, and the only node in a CSG subtree that draws a mesh (ADR-0027).
_Avoid_: "CSG parent", "combiner".

**Geometry contributor**:
A CSG node inside a **CSG root**'s subtree that draws nothing itself but supplies its solid and its `operation` to the root's boolean result.
_Avoid_: "brush", "child shape".

**Contribution**:
One **geometry contributor**'s solid in CSG-root-local space, with its `operation` and its material.
It is distinct from `three-bvh-csg`'s `Brush` and from Godot's `CSGBrush`.
_Avoid_: "brush".

**Open brush**:
A CSG shape's own solid whose edges, after `isClosedBrush` welds every vertex within `CSG_MERGE_TOLERANCE`, do not each carry faces that run both ways along them. Godot's manifold packs it as empty, so it draws nothing and empties the whole fold of its node.
_Avoid_: "non-manifold brush", since the previewer finds only this form of non-manifold input.

**CSG plan**:
The pure, React-free description of a **CSG root**'s subtree that `evaluateCsgPlan` consumes: contributions in evaluation order with matrices, operations, materials and a cache key.
_Avoid_: "CSG tree".

**CSG-as-primitive**:
The degraded fallback when boolean evaluation fails: each CSG node draws its own base geometry and ignores `operation` (ADR-0027).
_Avoid_: this term for intended behaviour.

**Transform-only group**:
A node rendered as an invisible `<group>` that positions its children and draws nothing, the render intent for a non-visual type whose Godot effect is nil or already implemented (ADR-0005, ADR-0008).
_Avoid_: "physics body" implying simulation. "transform container". "placeholder".

**Render intent**:
Which render outcome a node type declares, a visible renderer or a **transform-only group**, so "renders nothing" is a choice and not an accident (ADR-0006, ADR-0008).
The **AnimationPlayer**, a **geometry contributor** and a **sub-viewport** are transform-only groups that are not inert.
_Avoid_: "placeholder", "not implemented". "inert" for those three roles.

**Pending** (render intent):
A node type whose Godot effect, an own visual or the drive of a **Driver**, is not implemented yet, registered on an **invisible base** with `renderIntent: 'pending'` (a `Control`-based gap registers no component) and the sheet status `unimplemented` (ADR-0045).
_Avoid_: bare "pending" for a resource load (say "load pending").

**Invisible base**:
A base component that places a node's transform for its children and draws nothing: Node3D, Node2D, Node and an undrawn GeometryInstance3D.
`NodeComponentRegistry` refuses a **Pending** registration on any other component, and a `draws` registration on an invisible base, so the badge cannot call a drawn node a gap or a gap drawn.
_Avoid_: "fallback" (that is the dispatcher's `GenericNodeFallback` for an unregistered type).

**Driver**:
A node with no geometry of its own that moves, deforms or animates other nodes, such as AnimationPlayer, RemoteTransform3D and a SkeletonModifier3D.
A drive the previewer does not run registers **Pending** and is `unimplemented`, never `linter-only` (ADR-0045).
_Avoid_: "controller" (collides with `XRController3D`). "inert".

**Editor cursor** (`r3f/godotEditorCursor.ts`):
Godot's `Cursor`, an orbit focus point plus the pitch, yaw and radius of the eye, from which every 3D gesture rebuilds the camera.
_Avoid_: "camera state". "orbit target" for the whole cursor.

**Preview sun**:
The stand-in directional light from Godot's editor that the previewer adds to a scene with no `DirectionalLight3D` (ADR-0025).
_Avoid_: "default light", "fill light".

**Preview environment**:
The stand-in **WorldEnvironment** from Godot's editor, a procedural sky for background and ambient light, added to a scene with no `WorldEnvironment` (ADR-0025).
_Avoid_: "default environment", "skybox". Coupling it to the **Preview sun**.

**Yield** (of preview lighting):
What a preview element does when the scene has a node of its type anywhere in the **Live scene tree**: it does not mount.
_Avoid_: "override", "fallback".

**Sky ambient**:
The illumination a sky background gives the scene, which in Godot is a radiance map that both lights and reflects, unlike the flat `AMBIENT_SOURCE_COLOR`.
_Avoid_: "ambient light" alone for the sky case. "IBL" in user-facing text.

**Exposure factor** (`r3f/environment/worldExposure.tsx`):
The `exposure_multiplier` of the CameraAttributes that a world renders with. A world with no CameraAttributes has none, which a baked lightmap tells from the factor 1.
_Avoid_: "exposure" alone, which `tonemap_exposure` also names. "Brightness".

**Auto exposure** (`r3f/environment/LuminanceReduction.ts`):
The exposure divided by the **Frame luminance** over `auto_exposure_scale`, in the tone-map pass and the glow's bright pass. A still frame shows the settled value, so `auto_exposure_speed` has no part.
_Avoid_: "eye adaptation", "adaptive exposure".

**Frame luminance**:
The one value the **Auto exposure** reads: the largest channel of the HDR frame, averaged in 8-texel blocks over the top left region the last level reaches, held between the luminance range of the CameraAttributes.
_Avoid_: "brightness", "average colour". The mean of the whole frame, which Godot's blocks do not compute.

**Radiance layer**:
One of the blurred copies of a sky's radiance that Godot bakes, each for a wider roughness, which rough reflections and the **Sky ambient** read.
_Avoid_: "mip" for a layer, "PMREM" for Godot's layers.

**Fast filter**:
Godot's tap-table filter that bakes the **Radiance layers** of a sky in Real-Time process mode, in place of GGX importance sampling.
_Avoid_: "real-time filter", "low-quality filter".

**Reflection probe capture** (`r3f/reflectionProbe/`):
The six 90-degree renders of the scene from a ReflectionProbe's `origin_offset`, with its `cull_mask` and its `interior` rule, that the previewer bakes into **Radiance layers** as Godot does.
_Avoid_: "probe cubemap", "probe bake".

**Reflection atlas** (`resources/sky/skyLayers.ts`):
The array texture that holds every **Reflection probe capture**, one layer per probe, each with its **Radiance layers** as mips.
_Avoid_: "probe texture", "cube array".

**Depth fog**:
The Environment's `fog_*` fog, which fades a surface towards the fog colour with its distance from the camera.
_Avoid_: "screen-space fog". Bare "fog" where **volumetric fog** is on too.

**Volumetric fog**:
The Environment's `volumetric_fog_*` medium. It fills a volume of **froxels** in front of the camera, scatters the lights and the ambient, and hazes every surface and the background behind it.
_Avoid_: "fog volume", which names the FogVolume node.

**Froxel**:
One cell of the volume that **volumetric fog** fills: a screen tile at one depth slice, shaped like a piece of the camera frustum.
_Avoid_: "voxel", which names a cube in world space.

**Fog volume**:
A FogVolume node's shape, which adds the density, albedo and emission of its FogMaterial to every **froxel** it covers. A negative density removes fog.
_Avoid_: "local fog", "fog area".

**Density texture**:
The 3D texture a FogMaterial multiplies a **fog volume**'s density by, sampled across the volume's size.
_Avoid_: "fog texture", "noise volume".

**Area light atlas** (`r3f/areaLight/areaLightAtlas.ts`, `atlasLayout.ts`, `atlasMipmaps.ts`):
The one texture that holds the `area_texture` of every AreaLight3D, each in a cell with a border and a chain of blurred mips, as Godot 4.7.2 builds it.
A surface reads the mip its distance to the light asks for, so a far surface sees the texture's average colour.
_Avoid_: "projector atlas", which names the omni and spot lights' `light_projector` textures.

**Decal term** (`r3f/decal/`):
The part of every 3D program's fragment shader that mixes the decals into the surface, as Godot's clustered shader does: the albedo of every program, and the normal, roughness, metallic, occlusion and emission of a lit one. It reads the decals' band of the Scene rows, which each render of a scene packs, and the Decal atlas.
_Avoid_: "decal projection", which names the baked mesh the term replaced.

**Scene rows** (`r3f/sceneRows/`):
The one float texture that holds the rows of a scene's Reflection probes and Decals: the probes' first, the decals' after them. Each row is one probe or decal, as the shader fetches it.
Both share it because a fragment shader has 16 texture units.
_Avoid_: "probe rows" and "decal rows", which name one band of it.

**Decal atlas** (`nodes/3d/decal/decalAtlas.ts`, `decalAtlasLayout.ts`, `decalAtlasLevels.ts`):
The one texture that holds the albedo, normal, ORM and emission textures of every Decal, each in a cell with a border of transparent texels, as Godot builds it. Its five levels each halve the whole level above.
The Decal term reads each Decal's rectangle of each map, so the rim of a projection blends the border, and a small level can blend a neighbouring texture.
_Avoid_: "decal texture", which names one Decal's own `texture_albedo`.

**Geometry instance**:
A drawn 3D Node (a GeometryInstance3D) whose own render state, such as `transparency` and `cast_shadow`, applies to every surface it draws.
_Avoid_: bare "instance", which names **PackedScene instancing**.

**Geometry base**:
The mesh, multimesh or particles a **geometry instance** hands Godot's renderer to draw. A MeshInstance3D has one only with a mesh, and a CSG shape only as a root. Godot's scene cull indexes an instance only when it has one and its AABB has a surface.
_Avoid_: "drawn", which says what the previewer draws, not what Godot holds.

**Visibility range**:
The camera distances between which a **geometry instance** draws, measured to the centre of its world AABB. Fade mode SELF blends it in across the margins.
_Avoid_: "LOD", which names mesh level of detail.

**Visibility parent**:
The **geometry instance** whose **visibility range** decides whether another draws. A dependant draws only while the camera is short of its parent's begin, or inside a DEPENDENCIES margin, where it fades in. A Node3D without its own `visibility_parent` takes its Node3D parent's. A parent the scene cull does not index, with no **geometry base** or a flat AABB, is no parent.
_Avoid_: "LOD parent", "HLOD parent".

**Fade alpha**:
The alpha a **geometry instance**'s `transparency` and **visibility range** fade give every surface it draws, as Godot stores it in a byte. The surface's own alpha multiplies it.
_Avoid_: "instance alpha", "instance transparency".

**Alpha pass**:
Godot's sorted, blended draw of a surface after the opaque pass. A material's alpha mode, or a **fade alpha** below 0.999, sends a surface there.
_Avoid_: "transparent pass".

**Resource event bus** / `useResource`:
The async resource pipeline: a component calls `useResource(path, type)`, the host `ResourceLoader` fetches, and a `loaded` or `missing` event resolves the hook.
_Avoid_: "asset loader".

**PackedScene instancing**:
A Node with `instance = ExtResource("scene_id")` whose `.tscn` or `.glb` is loaded and composed into the host tree.
_Avoid_: "include", "prefab".

**Instance root merge** (`mergeInstanceRoot`, applied through `LiveTree.stepOf`):
The collapse of a single-root `.tscn` instance, where the instance Node becomes the sub-scene's root and its own properties win per key.
Every consumer takes the merge from its **Live step** so node paths agree. A multi-root instance and a lone `.glb` instance are not merged: the node that instances a `.glb` is the **GLB root**.
_Avoid_: "wrapper node", "prefab flattening", "compose". A merge decision derived again in a consumer.

**GLB root**:
The node that instances a lone `.glb`, as in Godot. Each GLB object has the path of that node followed by its own, and no row stands for the **GLBSceneRoot**.
The children of a GLB object or of the GLB root stand in one order, whether each is a GLB object, an attached node or a node of the instancing scene. The rows and the viewport share that order.
_Avoid_: A path segment for the GLB file name. Two paths for one GLB object. A second order for a GLB child.

**Imported scene tree** (`godot/import/gltfImportScene.ts`):
The nodes Godot's glTF importer builds from a `.glb`, each with its full path below the **GLB root**. It holds a Skeleton3D, a BoneAttachment3D for each bone with a child, and a skinned mesh below its Skeleton3D, which three's graph does not.
_Avoid_: A match on three's names or levels. A nearest-ancestor or ordered-subsequence match.

**Frame group** (`resources/formats/glb/frameGroups.ts`):
The `THREE.Group` that stands for a Skeleton3D or a BoneAttachment3D of the **Imported scene tree**. A Skeleton3D group holds the root bones of its skeleton. A BoneAttachment3D group holds the nodes that hang on its bone. A property written to the node lands on its group, and a path through the group is the path without it.
_Avoid_: A stand-in object. A path segment for the group.

**Automatic skin** (`automaticSkinMatrices`, `nodes/3d/skeleton3d/skeletonPose.ts`):
The skin Godot builds from the global rest of each bone when a MeshInstance3D names a Skeleton3D and sets no `skin` (`skeleton_3d.cpp:975-1014`). A bone's matrix is its global pose times the inverse of its global rest. The model is three-free, and the **Live scene pass** in `skeletonBindings.ts` hands the matrices to the mesh by its live path, so the mesh draws as a SkinnedMesh.
_Avoid_: A CPU bake of the vertices. A skin read from a Skin resource. A pose kept in three bones.

**Pose modifier** (`PoseModifier`, `nodes/3d/skeleton3d/skeletonPose.ts`):
The edit a SkeletonModifier3D child makes to the bone poses of its Skeleton3D, and its `influence`. The Skeleton3D pass runs the edits in child order on a copy of the file pose, before it makes the **Automatic skin**, as `Skeleton3D::_process_modifiers` does (`skeleton_3d.cpp:1166-1204`). The file pose is kept. A type registers a reader from its node to its edit as `poseModifier`.
_Avoid_: A write to the bone table. A modifier that draws.

**Bone pose** (`BonePose`, `AnimatedPose`, `nodes/3d/skeleton3d/skeletonPose.ts`):
The position, rotation and scale of one bone, each part optional. An AnimationPlayer writes the poses its bone tracks sample, and the Skeleton3D pass lays them over the file pose before the **Pose modifier** edits run (`animation_mixer.cpp:1878-1891`). A part no track keys keeps the file pose.
_Avoid_: A write to the bone table. A pose kept in three bones.

**Override re-homing** (`rehomeOverride`, carried as `LiveNode.scope`):
The copy of each resource an override names into the scope of the node it reaches, under a fresh id where that id is taken, so each property resolves in the file that wrote it (ADR-0051).
Each copy keeps the id its own file wrote as `authoredId`, and the inspector shows that id.
_Avoid_: one scope stamped over a node two files wrote. A scope tag on `TscnNode`.

**Cyclic instancing** (`SceneScope.instancedScenePaths`):
An instance of a PackedScene that already encloses it, directly or through other instances.
Godot's loader refuses it, so the **Live scene tree** keeps the instance as a leaf and the viewport draws the magenta placeholder of a failed load.
_Avoid_: "recursive scene". A depth limit to stop it.

**Sprite-frame composition** (`r3f/spriteFrame.ts`):
The shared region_rect plus hframes/vframes UV maths for SpriteBase nodes, which each slice calls with its own wrap mode (`SpriteWrapMode`).
_Avoid_: region or frames maths inlined in a slice. A default wrap mode. "clip" or "crop" for an oversized region.

**Stated-consumer-default wrapping**:
The rule that each consumer chooses a shared texture's wrapping at bind time, never the loader (`textureProcessing.ts`), which leaves three's clamp-to-edge default.
_Avoid_: wrapping set in the loader. A shared cache entry's wrapping changed in place.

**Synthetic render type**:
A render-only component with no parser and no linter (`GenericNodeFallback`, `GLBSceneRoot`), kept in `r3f/internal/`.
_Avoid_: "default node".

### Shell & editing

**Source pane**:
The web previewer's editable `.tscn` text view beside the preview shell, whose one buffer feeds both the linter and the rendered scene (ADR-0020).
Edits stay in the browser until a "Download .tscn" export.
_Avoid_: "code editor", "Monaco", "CodeMirror".

**Host (app)**:
An embedding application, the web previewer or the VS Code extension, that mounts the shared preview shell over its own resource loader and source-text feed.
_Avoid_: bare "host" for VS Code's extension-host process. Bare "frontend" or "app".

**Hold-last-valid** (web):
The **Source pane**'s edit gate: the viewport keeps the last cleanly parsed buffer while mid-edit text is broken.
_Avoid_: "debounce" for the gate. Gating the linter.

**Preview panel** (VS Code):
The per-document webview the extension opens beside the editor, pinned to one `.tscn` document (ADR-0023).
_Avoid_: "preview tab", bare "webview". Follow mode.

**Save-driven refresh** (VS Code):
The **Preview panel**'s update contract: it refreshes in place on save and on disk changes, never on unsaved keystrokes (ADR-0021).
_Avoid_: "reload".

**Dependency hot-reload** (VS Code):
A disk change to a dependency refreshes only that resource in every open **Preview panel** that resolved it, at any dependency depth.
_Avoid_: "HMR", "direct dependencies".

**Progressive fill-in**:
How both **Host**s update after a parse: the scene renders at once from the text, then each resource appears as its load lands.
_Avoid_: loading-screen framing. A missing resource as a scene error.

**Corpus root** (web):
The active fixture's `res://` namespace, which scopes every resource lookup and **Resource upload** so two corpora never share bytes.
_Avoid_: "fixture folder".

### Content intake (web)

**Fixture**:
A built-in scene the web previewer ships as a static file, copied from `scenes/` into `apps/textscene-web/public/fixtures`.
_Avoid_: "sample", "template".

**Fixture catalog**:
The browsable, categorised manifest of every **Fixture**, generated by `pnpm generate:fixtures`.
_Avoid_: "scene library".

**Fixture project**:
A `scenes/fixtures` subdirectory with its own `project.godot`, for a **Fixture** that needs a project setting no `.tscn` can carry. The subdirectory is its **Corpus root**, so the setting reaches no other fixture.
_Avoid_: "nested fixture".

**Uploaded scene**:
A user's `.tscn` opened as the active scene, kept only in the browser (ADR-0022).
_Avoid_: "imported scene".

**Resource upload**:
A user file that fulfils one `res://` reference, added from a **Missing resource** row or by **Multi-file matching**, and scoped to the active corpus.
_Avoid_: **Uploaded scene** for this.

**Multi-file matching**:
The one-gesture drop or select contract: the root-most `.tscn` becomes the **Uploaded scene**, and every other file, an **Import sidecar** or `project.godot` included, fulfils a `res://` reference by case-insensitive basename.
_Avoid_: "import wizard".

**Missing resource**:
A `res://` reference or **Sub-resource path** whose load failed. Its consumer may draw a magenta placeholder, and the missing-resources panel shows one row per address. A **Sub-resource path** into a file that loads but declares no such `[sub_resource]` is one too, since Godot's load of it fails.
_Avoid_: "broken scene", "load error".

### Animation

**GodotAnimation**:
One named Godot animation: a `[sub_resource type="Animation"]` with `length`, `loop_mode`, `step` and value **Track**s, built into a `THREE.AnimationClip` for playback.
_Avoid_: "AnimationClip" for the parsed form. Bare "clip".

**Animation library**:
The `[sub_resource type="AnimationLibrary"]` whose `_data` maps clip names to **GodotAnimation**s, referenced through `libraries/<name>`.
_Avoid_: bare "library".

**Track**:
One animated property of a **GodotAnimation**, which targets `NodePath("Node:property")` with ordered **Keyframe**s.
The `THREE.AnimationMixer` drives transform tracks, and the **AnimatedValue push registry** drives the wired non-transform ones (ADR-0016, ADR-0017).
_Avoid_: "channel".

**AnimatedValue push registry** (`r3f/contexts/AnimatedValueContext.tsx`):
The registry, keyed by `${nodePath}:${property}`, through which the active **AnimationPlayer** pushes sampled non-transform **Track** values to their target.
_Avoid_: "AnimatedFrame registry", "mixer", "central value context".

**Animation transport**:
The play, pause and scrub state (`AnimationTransportContext`) and its dock-tab UI, bound to the one driver selected in the scene tree.
It starts stopped, and a change of selection stops playback and restores the authored pose.
_Avoid_: "scene-level transport". "timeline" or "player controls" for the whole transport.

**RESET animation**:
Godot's rest-pose animation named exactly `RESET`, which the **Animation transport** picks by default only when it is the sole clip.
_Avoid_: `RESET` as an ordinary playable clip.

**Animation root** (`root_node`):
The scene node a clip's **Track** NodePaths resolve from, by default `..`, the player's parent (ADR-0011).
_Avoid_: "target root".

**GLB-embedded clip**:
An animation authored inside a `.glb` or `.gltf` that the glTF loader delivers as a ready-made `THREE.AnimationClip`, never a **GodotAnimation**.
_Avoid_: "GodotAnimation" for these. Bare "imported animation".

**GLB animation driver**:
A **GLBSceneRoot** that plays its **GLB-embedded clip**s with a mixer rooted on the GLB object, activated by a synthesised tree-only `GLBAnimationPlayer` row (ADR-0014).
_Avoid_: the `GLBAnimationPlayer` row as a real **AnimationPlayer** Node.

**AnimationTree driver**:
An **AnimationTree** that owns no clips and drives the driver its `anim_player` names with a blend program evaluated at the authored `parameters/*` state (ADR-0019).
_Avoid_: **AnimationPlayer** for this driver. A selectable clip list.

**AnimationDriverRegistry** (`AnimationDriverContext`):
The `nodePath` to `{ object, clips }` lookup that an **AnimationPlayer** or **GLB animation driver** publishes into once its clips load.
It is two contexts: a stable register function and a reactive drivers map.
_Avoid_: **Animation transport** for this registry.

**Playback step** (`r3f/animation/`):
The pure per-frame decision, shared by every **Animation transport** driver, of which transition fires: ensure-playing, seek, hold-paused, stop-and-restore or none.
_Avoid_: play, pause, seek and stop edges derived again inside a driver's `useFrame`. "state machine" for the adapters.

**Driver mount** (`r3f/animation/`):
The shared lifecycle by which a clip-owning driver (**AnimationPlayer**, **GLB animation driver**) registers clips, publishes to the **AnimationDriverRegistry** and builds its mixer.
_Avoid_: this lifecycle for the **AnimationTree driver**.

## Relationships

- A **SceneGraph** holds **Node**s, and its roots feed the **NodeDispatcher**. In 2D **viewport mode**, the **ControlCanvasWalker** draws Control subtrees in the same canvas.
- A **Node** references **ExtResource**s and **SubResource**s by id, and the **resource event bus** resolves a `.tres`'s own SubResources under a **Sub-resource path** (ADR-0046).
- A **CollisionShape3D** Node references one **collision-shape resource**, which the **collision gizmo** draws.
- The three registries (**NodeRegistry**, **NodeComponentRegistry**, **ControlComponentRegistry**) share `typeName` keys but stay separate to keep the **React-free linter boundary**.
- A **vertical slice** exposes its behaviour through three **slice entry points**, one per registry domain.
- **Label3D**, **Label** and **RichTextLabel** share one shaping engine and font, but each run draws with the painter Godot's text server uses for it (ADR-0040).
- An **AnimationPlayer** references an **Animation library**, whose **GodotAnimation**s carry the **Track**s that the **Animation transport** plays (ADR-0011).
- An **AnimationTree driver** drives the **AnimationPlayer** or **GLB animation driver** that it finds through the **AnimationDriverRegistry** (ADR-0019).
- A **sub-viewport** publishes into the **ViewportTextureRegistry**, and only its **viewport surface** dispatches its canvas subtree (ADR-0033).
- Both **Host (app)**s mount the same preview shell. VS Code feeds it by **Save-driven refresh**, and the web feeds it from the **Source pane** under **Hold-last-valid**.

## Flagged ambiguities

- "Shape": the CollisionShape3D Node holds a `shape` reference, and the **collision-shape resource** carries the geometry.
- "Transform container": physics bodies are **transform-only groups**, and "Container" means the 2D layout Controls.
- "Registry": say **NodeRegistry** (parse), **NodeComponentRegistry** (3D render) or **ControlComponentRegistry** (2D render).
- "id": **UID reference** is the global `uid://`, and `id=` is the per-file resource handle.
- "AnimationClip": the parsed form is **GodotAnimation**, and the runtime object is always `THREE.AnimationClip`.
- "GLB AnimationPlayer": the synthesised `GLBAnimationPlayer` row, not the GLB root, activates the **Animation transport** (ADR-0014).
- "AnimatedFrame": the term is retired. The value-push path is the **AnimatedValue push registry** (ADR-0016, ADR-0017).
- "Zoom": always qualify it. In 2D it is a CSS scale factor (0.1–4), and in 3D it is the **Editor cursor**'s orbit radius in world units. A wheel zoom anchors to the pointer in both, and a touch pinch anchors only in 2D.
- "Host": **Host (app)** is the embedding application, and VS Code's process is always "extension host".
- "Viewport": bare "viewport" is the previewer's centre panel, and the Godot node is the hyphenated **sub-viewport** (ADR-0033).
- "Offscreen": only the canvas half of a **sub-viewport** is hidden from the parent (ADR-0033).
- "Key": React's remount key and three's `customProgramCacheKey` derive from one prop bag, and **Program input** names what they depend on (ADR-0038).
- "Transparency": a **geometry instance**'s `transparency` is a 0–1 fade, and a material's `transparency` is its alpha mode. Qualify it every time.
- "ControlDispatcher": the term is retired. The Control walker is **ControlCanvasWalker** (ADR-0037).
