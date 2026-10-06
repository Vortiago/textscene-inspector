# TextScene Inspector: Godot .tscn preview for VS Code

Shows a live 3D or 2D preview of a Godot `.tscn` file beside its text, without Godot. Works in desktop VS Code and in vscode.dev.

## Open the preview

1. Open the folder that holds `project.godot`. The extension resolves `res://` paths from there.
2. Open a `.tscn` file.
3. Run **TextScene: Open Preview to the Side**, or press <kbd>Ctrl+K V</kbd> (<kbd>Cmd+K V</kbd> on macOS).

Each `.tscn` file can have its own preview.

## Use the preview

- The viewport uses Godot's editor controls. Press <kbd>?</kbd> in the viewport for the full list.
- Click a node in the tree or the viewport to see its properties in the **Inspector** tab.
- Double-click a node in the tree to jump to its line in the source.
- Use the **3D/2D** switch for Control and Node2D scenes.
- A mesh whose texture is missing renders magenta. The **Resources** tab lists the missing path.
- Save the file, or a file it uses, and the preview updates. The camera stays where it is.

## Editor features

- **Problems panel:** the linter checks each open `.tscn` file. For a scene inside a Godot project in a workspace folder, it also reports a `.glb` or `.gltf` file the scene uses that Godot's importer refuses. Godot fails to load the scene or resource when a sub-resource, a `.tres` `[resource]` body, a connection or the root node uses the glTF file. The report is then an error when `project.godot` enables no editor plugin, declares no autoload, and the project holds no `.gdextension` file. Otherwise it is a warning, because one of them can add support. Where only other nodes use the glTF file, the scene loads without it, and the report is always a warning.
- **Problems panel (after a file change):** when a glTF file or `.godot/extension_list.cfg` changes on disk, the linter checks each open scene that reads it again. When someone creates or deletes a `.gdextension` file, a `.gdignore` or a `project.godot`, or changes `project.godot`, the linter checks the open scenes of that project again. When someone deletes or moves a folder, the linter checks again each open scene that read a file inside it, or whose project listed a `.gdextension` file inside it.
- **Outline:** the scene tree of the file. Click an entry to jump to its line.
- **Scene Tree view** in the Explorer: the same tree, for the scene in the active editor or the active preview. VS Code's Outline is empty while a preview is the active editor. Click an entry to jump to its line.
- **`res://` links:** Ctrl-click (Cmd-click on macOS) a path to open the file.
- **Go to Definition** on `SubResource("id")` and `ExtResource("id")` goes to the heading that declares the id.
- **Hover:** shows a class's base chain and a link to its reference page. On a property, it shows the type, the declaring class and the accepted values. On a resource id, it shows the declaration.
- **Completion:** node and resource classes, property names, enum values, resource ids and `res://` paths. Completion marks a deprecated property name.
- **Quick fixes:** rename a deprecated property name, or repair a typo in a property name or a class name.
- **Folding and document highlights:** fold each node and resource body, and highlight every use of a resource id.
- **Agent tools:** a coding agent in chat can lint a scene, read its node tree, open its preview, list its missing resources and, from VS Code 1.106, capture its preview as a PNG. Turn them off with `textscene.agentTools.enabled`.

To change the settings, search for `textscene` in the Settings editor.

The [`tscn-lsp` language server](../textscene-lsp/README.md) gives Neovim, Helix, Zed and other editors the same language features.

## More

- What renders, and how close it is to Godot: the [parity gallery](https://textscene-inspector.pages.dev/parity/index.html)
- Source and issues: [github.com/Vortiago/textscene-inspector](https://github.com/Vortiago/textscene-inspector)
- Also available: a [web previewer](https://vortiago.github.io/textscene-inspector/) and a [CLI linter](https://www.npmjs.com/package/@textscene/linter)
- License: [MIT](https://github.com/Vortiago/textscene-inspector/blob/main/LICENSE)
