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

- **Problems panel:** the linter checks each open `.tscn` file. For a scene inside a Godot project in a workspace folder, it also reports a `.glb` or `.gltf` file the scene uses that Godot's importer refuses. The report is an error, or a warning when the project enables an editor plugin or loads a GDExtension that can add support. A change on disk to a glTF file or `.godot/extension_list.cfg` checks again each open scene that reads it. A change to `project.godot` checks again the open scenes of that project.
- **Outline:** the scene tree of the file. Click an entry to jump to its line.
- **`res://` links:** Ctrl-click (Cmd-click on macOS) a path to open the file.
- **Go to Definition** on `SubResource("id")` and `ExtResource("id")`.

To change the settings, search for `textscene` in the Settings editor.

## More

- What renders, and how close it is to Godot: the [parity gallery](https://textscene-inspector.pages.dev/parity/index.html)
- Source and issues: [github.com/Vortiago/textscene-inspector](https://github.com/Vortiago/textscene-inspector)
- Also available: a [web previewer](https://vortiago.github.io/textscene-inspector/) and a [CLI linter](https://www.npmjs.com/package/@textscene/linter)
- License: [MIT](https://github.com/Vortiago/textscene-inspector/blob/main/LICENSE)
