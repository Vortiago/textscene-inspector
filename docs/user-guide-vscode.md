# TextScene Inspector: VS Code Extension User Guide

The TextScene Inspector VS Code extension shows a `.tscn` file as a live 3D preview beside its source text. Open a `.tscn` file in any text editor, then run **TextScene: Open Preview to the Side** from the command palette (F1) or the editor-title bar button. A webview panel renders the scene in a second editor group. The preview uses the shared Split Dock shell (ADR-0007): a scene-tree panel on top (search box, expand/collapse, per-node visibility toggles) and a tabbed detail panel below. Its tabs are **Inspector** (type, path, transform, mesh and material information), **Resources** (missing and uploaded resource files) and **Cameras** (switch the viewport to a scene camera). When you edit and save the source file, the preview reloads in place and keeps the camera angle across content-only edits.

Each section below covers one verification scenario from `docs/user-flows.md`, with a screenshot of that flow, and states what works and what does not.

`node scripts/showcase/vscode/capture.mjs` regenerates every screenshot below. It starts VS Code with `--extensionDevelopmentPath`, opens a throwaway copy of `scenes/fixtures` as the workspace, and drives the workbench into each flow's state before it captures the window. A shot and the paragraph beside it therefore describe one build.

## Opening the preview: VSCODE-01

Open a `.tscn` file from the explorer (single-click, or Ctrl-P to quick-open by name). Then run **TextScene: Open Preview to the Side** from the command palette (F1), or use the editor-title bar's open-preview button. A new tab labelled `Preview: <filename>.tscn` opens in a side editor group. The webview mounts and the scene-tree panel shows the parsed root node.

![Preview opens beside the source file, scene tree visible](screenshots/vscode/vscode-01-a.png)

In the screenshot above, `unit-box-mesh.tscn` is open in Editor Group 1 and its preview is in Editor Group 2. The scene-tree panel shows the `Root` Node3D parsed from the source. Below it, the Inspector tab reads "Select a node to see its properties."

The command is available only when the active editor is a `.tscn` file, through the `when: editorLangId == tscn || resourceExtname == .tscn` clause.

## Hot reload on save: VSCODE-02

Edit the source `.tscn` file in the text editor and save it, or let VS Code's auto-save do it. The extension host listens with `vscode.workspace.onDidSaveTextDocument` and calls `panel.update(...)` on the matching preview when the saved document is the previewed `.tscn`. A separate `createFileSystemWatcher('**/*.{tres,png,jpg,jpeg,svg,tscn}')` updates all panels when a dependent resource (texture, material, external scene) changes on disk. The webview parses the content again and updates the rendered scene without disposing the preview tab.

![Before edit: Box at origin](screenshots/vscode/vscode-02-a.png)

![After edit: Box translated, the Inspector tab shows Position X: 3.000](screenshots/vscode/vscode-02-b.png)

The capture changes the translation of the `Box` MeshInstance3D from `(0, 0, 0)` to `(3, 0, 0)` and saves. The preview reloads, and the Inspector tab for the selected `Box` node shows `Position X: 3.000`, `Y: 0.000`, `Z: 0.000`. The webview canvas redraws in place and the scene-tree panel keeps its expansion state.

## Two preview panels: VSCODE-03

You can open more than one preview panel at once, one for each `.tscn` file. Each panel renders its own scene and keeps its own selection. A click on a node in one panel does not affect the other.

![Two preview panels side by side, each showing a different fixture](screenshots/vscode/vscode-03-a.png)

![Independent selection: Box in left panel, Sphere in right panel](screenshots/vscode/vscode-03-b.png)

Above, `unit-box-mesh.tscn` and `unit-sphere-mesh.tscn` each have a preview in their own editor group, with both `.tscn` sources closed so the two panels fill the window. `Box` is selected in the first and `Sphere` in the second, and the two Inspector tabs read "Box" and "Sphere". Each panel has its own `SelectionContext`, and an edit to one fixture updates only its own preview.

## Ctrl-click `res://` paths: VSCODE-04

Two providers answer a click on a `.tscn` source line, and they answer different tokens:

- `TscnDocumentLinkProvider` returns each `res://` reference as a document link, so Ctrl-click opens that file. `findGodotProjectRoot` resolves the target: it walks up from the document's own directory to find `project.godot`, and falls back to the workspace root. This is Godot's own `res://` rule, and the preview panel uses the same resolution for the resources it loads.
- `TscnDefinitionProvider` answers `SubResource("id")` and `ExtResource("id")` call sites. It goes from a usage to the matching `[sub_resource ... id="..."]` or `[ext_resource ... id="..."]` heading **inside the same file**.

A token that is neither does nothing.

![unit-external-material.tscn with the caret on its res:// path](screenshots/vscode/vscode-04-a.png)

![After Ctrl-click: materials/metal.tres opens beside the source](screenshots/vscode/vscode-04-b.png)

## Outline panel: VSCODE-05

The Outline view (View → Outline, or the section below the Files Explorer when enabled) lists the scene-tree hierarchy of the open `.tscn` file. A click on an outline entry moves the editor to the matching `[node name="..."]` declaration in the source.

![Outline shows Level0 → Level1 → Level2 nested hierarchy from example-hierarchy-deep.tscn](screenshots/vscode/vscode-05-a.png)

The screenshot shows `example-hierarchy-deep.tscn` open with the Outline panel expanded. `TscnDocumentSymbolProvider` nests the document symbols as the source does:
- `Level0` (Node3D): level 1
- `Level1` (Node3D): level 2, child of Level0
- `Level2` (Node3D): level 3, child of Level1

The names match the source `[node name="..."]` declarations.

## Click-to-select in the webview: VSCODE-06

A click on a node in the webview's scene-tree panel selects it. The Inspector tab then shows the node's type, path, parent and, for a MeshInstance3D, its mesh sub-resource, material override, position, rotation and scale.

![CenterCube selected by a tree click: the Inspector tab shows its properties](screenshots/vscode/vscode-06-a.png)

The screenshot shows `integration-three-cubes.tscn` with the `CenterCube` Node3D selected. The Inspector tab reads "CenterCube", with Type: Node3D and Path: ThreeCubes/CenterCube.

A click on a mesh in the 3D viewport also selects it (the `useViewportSelection` hook), through the same `SelectionContext` as a tree click. No automated check covers that direction: see [Known limitations](#known-limitations-triage-list).

## Missing-texture meshes: VSCODE-07

When a scene references an external texture file that the workspace cannot resolve, the affected mesh renders in magenta, so you can see that something is missing. The `useResource` hook follows the SubResource → StandardMaterial3D → ExtResource Texture2D chain, finds the unresolvable `res://` path, and puts a magenta placeholder material on the `MeshInstance3D` that uses it. The **Resources** tab lists every missing path. The viewport shows no text label for it.

![test-missing-texture.tscn preview: TestMesh renders as a magenta placeholder cube](screenshots/vscode/vscode-07-a.png)

The fixture references `res://textures/test-upload.png`, which is absent on purpose. The scene tree shows `World → TestMesh, Camera`, and TestMesh renders as a magenta cube.

## Camera survives save: VSCODE-08

The camera's orbit position must survive a save that changes only the file's content (no path change). A save is a content-only update that React reconciles, not a full panel remount, and `useResource`'s late-arrival contract depends on that.

![Preview before content edit](screenshots/vscode/vscode-08-a.png)

![Preview after edit (transform X 0 → 1.5): same panel instance, scene re-rendered](screenshots/vscode/vscode-08-b.png)

The capture changes the Box translation to X=1.5 and saves. The preview tab stays the same instance, with no panel disposal and no remount, and the scene renders the new transform. Three facts keep the camera:

- The webview's React tree is reconciled, not remounted, on a content update.
- The camera pose lives on the THREE camera and the navigation handle, not in React state.
- `TscnPreviewShell` has no `key` prop that changes with the content.

No check measures the camera position itself, because the capture cannot read it from outside the cross-origin webview iframe.

## Integration scene: BOTH-01

`integration-all-primitives.tscn` is the integration fixture for both the web previewer and VS Code. The webview's scene-tree panel lists every expected child:

![integration-all-primitives.tscn scene-tree expanded: Floor, Capsule, Torus, Prism, BackWall, DirectionalLight, FillLight](screenshots/vscode/both-01-a.png)

- Root (Node3D)
  - FillLight (OmniLight3D): has transform
  - DirectionalLight (DirectionalLight3D): has transform
  - BackWall (MeshInstance3D): has transform
  - Prism (MeshInstance3D): has transform
  - Torus (MeshInstance3D): has transform
  - Capsule (MeshInstance3D): has transform
  - Floor (MeshInstance3D): has transform

The fixture renders without errors, and the tree lists all expected children.

## Every primitive renders: BOTH-02

Each mesh primitive renders in its own preview panel without console errors. VSCODE-01 describes the rendering pipeline.

- `unit-box-mesh.tscn`: `docs/screenshots/vscode/both-02-a.png`
- `unit-sphere-mesh.tscn`: `docs/screenshots/vscode/both-02-b.png`
- `unit-plane-mesh.tscn`: `docs/screenshots/vscode/both-02-c.png`
- `unit-cylinder-mesh.tscn`: `docs/screenshots/vscode/both-02-d.png`
- `unit-capsule-mesh.tscn`: `docs/screenshots/vscode/both-02-e.png`

Each fixture opens its own preview tab and renders its Root Node3D and the MeshInstance3D child.

## Lights and gizmos: BOTH-03

`integration-lights-all-types.tscn` contains a DirectionalLight3D, an OmniLight3D and a SpotLight3D. The fixture loads in the preview without errors.

![integration-lights-all-types.tscn loaded](screenshots/vscode/both-03-a.png)

`integration-mixed-nodes.tscn` combines lights with meshes, so you can see the shading on the geometry. It loads without errors.

![integration-mixed-nodes.tscn loaded](screenshots/vscode/both-03-b.png)

All three light types render through the component registry. No check reads the gizmo pixels inside the webview canvas from this capture.

## WorldEnvironment changes atmosphere: BOTH-04

Two fixtures with different `WorldEnvironment` configurations load without errors and parse the embedded `Environment` sub-resource.

![unit-world-environment-basic.tscn loaded](screenshots/vscode/both-04-a.png)

![unit-world-environment-no-fog.tscn loaded](screenshots/vscode/both-04-b.png)

Both fixtures contain `[node name="WorldEnvironment" type="WorldEnvironment"]` with an `environment = SubResource("Environment_1")` reference. The node registry dispatches the `WorldEnvironment` component for that type. The web previewer's BOTH-04 check compares the background pixels, and VS Code runs the same `@textscene/core` component. This capture cannot read the webview canvas, which is cross-origin.

## Known limitations (triage list)

Behaviour you are likely to meet, in priority order.

1. **Two providers answer a click, and they answer different tokens.** See VSCODE-04. A token that neither resolves does nothing.

2. **No automated check covers a click on a mesh in the viewport.** Selection from the rendered side works and uses the same `SelectionContext` as a tree click, but no gate clicks at canvas coordinates. The canvas itself is reachable: `pnpm test:vscode:csp` reads it back over CDP inside the real webview, which is how the text pipeline is gated.

3. **Console errors from other installed extensions.** Launching the Extension Development Host with `--extensions-dir=<empty>` keeps the extension under development loadable. It does not stop VS Code from scanning your installed extensions in `%USERPROFILE%\.vscode\extensions\` at startup. Each one that needs a newer VS Code version (Copilot, Pylance, Cosmos, SSH, and so on) logs a console error. These errors do not affect TextScene Inspector. For an isolated profile, point `HOME` (Linux/Mac) or pass `--extensions-dir` to an empty directory before launch. Normal extension use needs neither.
