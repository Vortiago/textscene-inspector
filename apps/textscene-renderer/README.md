# @textscene/renderer

`@textscene/renderer` draws a Godot `.tscn` scene in a React app. It is the renderer of the
[TextScene Inspector](https://github.com/Vortiago/textscene-inspector): a react-three-fiber canvas,
bundled into one ES module. React and three.js are peer dependencies, so your app keeps one copy of
each.

The package is not a 1:1 copy of Godot. Each node type has a comparison sheet that lists what the
renderer supports and where it differs from Godot 4.6. The
[index of the sheets](https://github.com/Vortiago/textscene-inspector/blob/main/docs/comparison/README.md)
links every one of them.

## Install

```bash
npm install @textscene/renderer react react-dom three @react-three/fiber
```

The renderer takes the text of a scene and parses it itself. The peer dependencies are
`react`, `react-dom`, `three` and `@react-three/fiber`.
`package.json` names the supported versions. The renderer patches three.js shaders, so a `three`
version outside that range can draw wrongly.

## Use

`openScene` opens the text of a scene. `<TscnCanvas scene={scene} mode="in-game" />` draws it as
the game draws it when it starts.

```tsx
import { TscnCanvas, openScene, type ResourceProvider } from '@textscene/renderer';

// Loads a scene's `res://` files: text for a text file, bytes for any other file, null for a miss.
const provider: ResourceProvider = {
  async loadResource(path) {
    const response = await fetch(`/game/${path.slice('res://'.length)}`);
    if (!response.ok) return null;
    return /\.(tscn|tres|godot)$/.test(path) ? response.text() : response.arrayBuffer();
  },
};

// `source` is the text of a `.tscn` file.
const scene = openScene({ source, provider });

export function GameView() {
  return (
    <div style={{ width: 640, height: 360 }}>
      <TscnCanvas scene={scene} mode="in-game" />
    </div>
  );
}
```

`<TscnCanvas>` fills its parent, so give the parent a size.

### The In-game mode

The In-game mode draws the root viewport of the scene as the game starts it:

- The scene's own cameras. Of two current Camera3D nodes, the last one in the tree wins, and with
  none current the first one wins. A 3D scene with no Camera3D shows the clear colour. A 2D scene
  draws through its Camera2D.
- The 3D world first, then the canvas items, the Controls and each CanvasLayer over it.
- The lighting of the game: the camera's Environment, else the scene's WorldEnvironment, else the
  project's default Environment, else none. No preview sun and no preview sky.
- No editor element: no gizmo, icon, grid, collision shape, path or navigation overlay. A light
  with `editor_only` gives no light.
- No camera navigation and no input: a click selects nothing.

Scripts do not run. The view shows the scene as Godot loads it, before any script changes it.

The provider serves `res://project.godot` when the project has one. The mode reads the window size,
the clear colour, the transparent background and the default Environment from it. The window fits
into the element at its aspect ratio, with bars around it.

Draw one view per page. The Decal atlas and the area light atlas are shared by every view on a
page, and #1005 gives each view its own.

### Change the scene from your code

The scene is the interface a script would use. Find a node, then read and write its properties, and
every view of the scene draws the change.

```tsx
import { openScene, variant } from '@textscene/renderer';

const scene = openScene({ source, provider });

await scene.getNode('HUD/Score').set('text', 'Score: 10');
await scene.getNode('%Player').set('position', variant('Vector3(4, 0, 2)'));
const visible = await scene.getNode('Enemy').get('visible');
```

- **Find.** `scene.getNode(path)` follows a NodePath as Godot's `get_node` does: from the root node
  of the scene, with `..`, `%Name`, and `/root` for the root window. A miss throws Godot's
  `Node not found` message, and `getNodeOrNull` answers `null`. A node inside a sub-scene is found
  once that sub-scene loads. `scene.observe(null, listener)` tells you when the tree changes.
- **Node handles.** A handle has `path`, `name`, `type` (the Godot class), `getNode`,
  `getNodeOrNull`, `getParent`, `getChildren` and `isInsideTree`. Two lookups of one node give the
  same handle. `scene.setSource(text)` frees every node: an old handle answers
  `isInsideTree() === false`, and a write to it throws.
- **Read and write.** `get(property)` and `set(property, value)` take every property of the class
  and its bases. They return promises, since the class table loads on the first call. `get` answers
  the last write, else the value in the file, else the class default. `set` answers `true` where
  Godot reports the write valid. A name the class does not have answers `false` and warns once.
- **Values.** A boolean, a number and a string pass as they are, and convert to the type of the
  property as Godot converts them. A whole number is an `int`. Any other type is `variant(text)`,
  with the text as a `.tscn` file spells it. `get` answers in the same forms.
- **Resources.** `await scene.load('res://icon.png')` gives a value that a property of a resource
  type takes, so you can swap a texture, a mesh, a material or a theme. A missing file draws as a
  missing resource.
- **Redraw.** The writes of one task draw one frame. A write before any view mounts shows on the
  first frame. `scene.observe(path, listener)` tells you when that node is written.

The limits of this release:

- No node is added, removed, moved or renamed. `set` of `script`, `instance` or `name` throws.
- A write replaces a whole property. A write inside a resource, such as the colour of a material,
  is not possible: swap the whole resource.
- A property that Godot computes from the layout, such as the `size` and `position` of a `Control`,
  throws with the name of the property. So do a running property, such as `playing`, and the global
  transform of a `Node2D` under a `Control` (#2003).
- Most setters store the value as Godot casts it, and run none of their own checks. The global
  transforms, the anchors of a `Control`, `frame_coords` and `volume_linear` run Godot's setter
  (#2002).
- `get` of a property that a scene pass drives, such as the target of a `RemoteTransform3D`, answers
  the value under the pass.
- Scripts do not run, no signal reaches your code, and no input reaches the scene.

### The 3D mode

With no `mode`, or `mode="3D"`, the view draws the scene as the Godot editor's 3D view does: an
orbit camera, the preview sun and sky, and the gizmos. It draws 3D content. A scene of 2D nodes,
such as `Control` or `Node2D`, draws nothing in it.

`<TscnSceneProvider>` opens the scene from its text for a view and for `useSelection`:

```tsx
import { TscnCanvas, TscnSceneProvider } from '@textscene/renderer';

export function SceneView({ source }: { source: string }) {
  return (
    <TscnSceneProvider source={source} provider={provider}>
      <div style={{ width: 640, height: 480 }}>
        <TscnCanvas />
      </div>
    </TscnSceneProvider>
  );
}
```

## API

The package exports these names.

- `openScene({ source, provider, rootScenePath? })`: opens the text of a scene and returns a
  `Scene`. It parses the text once, the first time a view reads it.
- `Scene` (a type): an open scene. `setSource(text)` replaces its text, and every view of it draws
  the new text. `getNode`, `getNodeOrNull`, `load` and `observe` are in "Change the scene from your
  code". `dispose()` closes it.
- `NodeHandle` (a type): a node of a scene, which `getNode` gives.
- `variant(text)`: a value of any Godot type, as a `.tscn` file spells it. It throws for a text
  Godot cannot read.
- `Variant` and `SceneValue` (types): what `variant` gives, and what `get` and `set` take.
- `TscnCanvas`: the view. Its props are `scene` (a `Scene`, optional inside
  `<TscnSceneProvider>`), `mode` (`'in-game'` or `'3D'`, default `'3D'`) and `className`.
- `TscnSceneProvider`: mounts what the view reads. Give it `scene` (a `Scene`), or `source` (the
  text of a `.tscn` scene), `provider` (a `ResourceProvider`) and `rootScenePath` (the `res://` path
  the scene opens under, optional). It takes `children`. A new `provider` starts a new resource
  loader.
- `ResourceProvider` (a type): `loadResource(path, type?)` returns the file as a string or an
  `ArrayBuffer`, or `null` when the file is missing.
- `useSelection`: the selected node path and the functions that change it. Call it in a component
  inside `<TscnSceneProvider>`.

## Styles and workers

The bundle adds one `<style>` element to the page when it loads. Your app needs no CSS-module
support and no stylesheet import. A page with a strict `style-src` policy must allow that element.

The renderer builds procedural textures, such as `NoiseTexture2D`, on the main thread. It starts no
worker.

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`. The build writes the notices from the
modules it bundles: the Godot Engine MIT notice covers the Godot code in the renderer, and the file
names the other third-party code it holds.
