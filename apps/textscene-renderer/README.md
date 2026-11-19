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
  draws through its Camera2D. A call from your code moves the camera: see "Set the camera".
- The 3D world first, then the canvas items, the Controls and each CanvasLayer over it.
- The lighting of the game: the camera's Environment, else the scene's WorldEnvironment, else the
  project's default Environment, else none. No preview sun and no preview sky.
- No editor element: no gizmo, icon, grid, collision shape, path or navigation overlay. A light
  with `editor_only` gives no light.
- No camera navigation and no input: a click selects nothing.

Scripts do not run. The view shows the scene as Godot loads it, before any script changes it.

The provider serves `res://project.godot` when the project has one. The mode reads the window size,
the stretch settings, the clear colour, the transparent background and the default Environment from
it. The window is the size `display/window/size/*` gives it, also under a fullscreen window mode.
`display/window/stretch/*` maps the scene into the window as the game does, with black bars where
the aspect is kept. The window fits into the element at one scale. A resize of the element changes
that fit, not the window size.

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
- **Resources the scene file holds.** Name a `[sub_resource]` by its path, as Godot's `load` does:
  `scene.load('res://main.tscn::SphereMesh_1')` or `variant('Resource("res://main.tscn::SphereMesh_1")')`,
  with the path the scene opens under. `SubResource("…")` has a meaning only inside a file: Godot
  reads `variant('SubResource("SphereMesh_1")')` as the file `res://SphereMesh_1`.
- **The class of a resource.** A resource of a class the property does not take writes `null`, and
  `set` answers `false`, as in Godot.
- **Redraw.** The writes of one task draw one frame. A write before any view mounts shows on the
  first frame. `scene.observe(path, listener)` tells you when that node is written.

### Set the camera

A host's code moves the camera of a viewport as a script does, with `call`:

```tsx
await scene.getNode('Cameras/Close').call('make_current');
await scene.getNode('Cameras/Close').call('clear_current', false);
const current = await scene.getNode('/root').call('get_camera_3d');
```

- **Camera3D.** `make_current`, `clear_current(enableNext = true)` and `is_current`.
  `set('current', value)` runs `set_current`, and `get('current')` runs `is_current`. With
  `enableNext`, the next camera of the viewport takes over. Without it, the viewport draws the clear
  colour.
- **Camera2D.** `make_current` and `is_current`. `make_current` on a camera that is not enabled
  changes nothing and warns. `set('enabled', false)` on the current camera passes the view to the
  first enabled camera in the tree.
- **Viewport.** `get_camera_3d` and `get_camera_2d` give the handle of the current camera, or `null`.
  The root window is `/root`. Each SubViewport keeps its own camera.
- **Setters and getters.** `call('set_<property>', value)` and `call('get_<property>')` reach `set`
  and `get`, by the names Godot gives them. Any other method throws with the class and the method.
- **Errors.** Where Godot's `call` prints an error, `call` throws with the same text: a wrong count
  of arguments, or an argument it cannot convert, such as a string for a bool. `set('current', value)`
  converts the value as Godot's `set` does, and answers `false` when the conversion is not exact.

`scene.cameras()` lists every camera inside the tree by its live path, with its viewport (`null` for the
root window), `isCurrent`, and `canBeCurrent`, which is false for a Camera2D that is not enabled. A
camera list in your page reads it, and `scene.subscribe` tells you when a call or a load moves it.

The In-game mode draws through the current camera. The 3D mode keeps its orbit camera.

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

### Know when the scene is whole

A view is settled when a frame shows the scene whole: the frame drew the latest change to the scene,
and no file, texture or font of the scene was still loading. This holds in every mode. A write or a
camera call from your code, or a new text, makes it pending again until a frame shows the change.

One view reports to each `<TscnSceneProvider>`. A second view under the same provider draws, but it
reports nothing and logs an error. Give each view its own provider.

`useGameViewSettled()` answers `null` while the view is pending, and then
`{ scriptedNodeCount, hasCurrentCamera, missingFiles }`: the count of nodes that hold a script, which
do not run, whether the root viewport has a current Camera3D or Camera2D, and the files the frame
asked for and did not get. The first two are facts of the game's start, so the 3D and 2D modes give
the same value. Call it in a component below the same `<TscnSceneProvider>` as the view:

```tsx
import { TscnCanvas, TscnSceneProvider, useGameViewSettled } from '@textscene/renderer';

function Status() {
  const settled = useGameViewSettled();
  if (!settled) return <p>Loading…</p>;
  return <p>{settled.scriptedNodeCount} nodes hold a script, and scripts do not run.</p>;
}

export function GameView() {
  return (
    <TscnSceneProvider scene={scene}>
      <div style={{ width: 640, height: 360 }}>
        <TscnCanvas mode="in-game" />
      </div>
      <Status />
    </TscnSceneProvider>
  );
}
```

### Know which files are missing

`scene.missingFiles()` gives the `res://` paths that the views of the scene asked for and did not get:
a `null` from `loadResource`, or a file that fails to load. A path leaves the set when no view asks
for it any more, or when it loads. `scene.subscribe` tells you when the set changes. The scene asks
for a file only when a view draws a node that reads it, so a scene with no view has no missing files.

Godot's editor lists the same files when it opens a scene: each file a property reads that fails to
load. A file that the scene declares and no property reads is in neither list.

### Mount the view with no React code

`mountScene(element, scene, { mode, visible })` mounts the view in a page element, for a page with
no React code of its own. React stays a peer dependency. `mode` is the mode of `TscnCanvas`, and
here it is `'in-game'` by default. The page changes the scene through the same `scene`, as a React app does.

A whole page, with a button that saves the window as a PNG file:

```html
<!doctype html>
<html>
  <body>
    <div id="game" style="width: 640px; height: 360px"></div>
    <p id="status">Loading…</p>
    <p id="missing"></p>
    <button id="save" disabled>Save PNG</button>
    <script type="module" src="./main.ts"></script>
  </body>
</html>
```

```ts
// main.ts
import { mountScene, openScene } from '@textscene/renderer';

// Every res:// path of the scene loads from the folder of the project on this site.
const provider = {
  async loadResource(path: string) {
    const response = await fetch(`/project/${path.slice('res://'.length)}`);
    if (!response.ok) return null;
    return /\.(tscn|tres|godot|gd|gdshader)$/.test(path) ? response.text() : response.arrayBuffer();
  },
};

const source = await (await fetch('/project/main.tscn')).text();
const scene = openScene({ source, provider, rootScenePath: 'res://main.tscn' });
const view = mountScene(document.getElementById('game')!, scene);

const { scriptedNodeCount, hasCurrentCamera } = await view.settled;
document.getElementById('status')!.textContent = hasCurrentCamera
  ? `Settled. ${scriptedNodeCount} nodes hold a script, and scripts do not run.`
  : 'Settled, with no current camera.';

// The list follows the scene: a write that stops reading a file takes it off.
const showMissing = () =>
  (document.getElementById('missing')!.textContent = [...scene.missingFiles()].join(', '));
showMissing();
scene.subscribe(showMissing);

const save = document.getElementById('save') as HTMLButtonElement;
save.disabled = false;
save.onclick = async () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await view.captureImage());
  link.download = 'scene.png';
  link.click();
  URL.revokeObjectURL(link.href);
};
```

`mountScene` returns a `View` with four members:

- `settled`: a promise of the settled value, in every mode. Each read gives a new promise, which
  waits again after the scene changes. It rejects once the view is disposed.
- `captureImage()`: a PNG `Blob` of what the view draws. It rejects before the view is settled, and
  the message names the pending work.
  - In-game, it is the game window at the window's size, whatever the size of the element: 1152 x
    648 for a project that sets no size. It has the black bars of the window. Where the project has
    a transparent background, the clear colour has alpha 0 and the bars stay opaque, as in Godot.
  - In the 3D and 2D modes, it is the canvas at its own size: the element's size times the device
    pixel ratio. The 2D mode's rulers, axes and zoom buttons are not part of it.
- `update(options)`: changes the mounted view. It takes the options of `mountScene` and changes
  only the keys it gives a value. See "Change a mounted view".
- `dispose()`: unmounts the view and loses its WebGL context, since a browser keeps few contexts
  alive. The scene stays open, so another view can mount it.

### Change a mounted view

`update` switches the mode, and stops or starts the frames, of a view that is mounted:

```ts
const view = mountScene(document.getElementById('game')!, scene);

// The editor's 3D view of the same scene. Every write to the scene stays.
view.update({ mode: '3D' });

// A hidden panel draws no frame. A load, a settle and a capture still draw the frames they need.
view.update({ visible: false });
view.update({ visible: true });
```

A change of mode replaces the canvas and loses the WebGL context of the old one. A `settled`
promise read before a switch resolves once the new mode settles. `update` throws once the view is disposed. A
view that failed to mount stays failed: dispose it and mount again.
`visible` is `true` by default. While it is `false`, the view draws only the frames a load, a settle or a capture needs: a write to a
hidden view draws until the view settles again.
`<TscnCanvas visible={false} />` does the same in React.

### Save a PNG from headless Chromium

A browser draws the view: the renderer needs WebGL 2, and Node has no WebGL 2. Build a page that
mounts the scene, then drive the page with [Playwright](https://playwright.dev):

```ts
// page.ts, built into the page at http://localhost:5173/
import { mountScene, openScene } from '@textscene/renderer';

declare global {
  interface Window {
    capturePng(): Promise<string>;
  }
}

window.capturePng = async () => {
  const scene = openScene({ source, provider });
  const view = mountScene(document.getElementById('game')!, scene);
  await view.settled;
  const png = new Uint8Array(await (await view.captureImage()).arrayBuffer());
  view.dispose();
  let binary = '';
  for (const byte of png) binary += String.fromCharCode(byte);
  return btoa(binary);
};
```

```ts
// capture.mjs, run with Node
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

// A machine with no GPU draws WebGL only through SwiftShader, which Chromium enables on request.
const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
});
const page = await browser.newPage();
await page.goto('http://localhost:5173/');
const base64 = await page.evaluate(() => window.capturePng());
writeFileSync('scene.png', Buffer.from(base64, 'base64'));
await browser.close();
```

SwiftShader draws in software, so a large scene can take seconds for its first frames.

### The 3D mode

With no `mode`, or `mode="3D"`, the view draws the scene as the Godot editor's 3D view does: an
orbit camera, the preview sun and sky, and the gizmos. It draws 3D content. A scene of 2D nodes,
such as `Control` or `Node2D`, draws nothing in it: use the 2D mode.

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

### The 2D mode

With `mode="2D"`, the view draws the scene as the Godot editor's 2D view does: the canvas items and
the Controls inside the frame of the project's window, with the gizmos. A drag pans the view, the
wheel zooms it, and the buttons in the corner zoom it and fit the frame. It draws no 3D content.

```tsx
<TscnCanvas scene={scene} mode="2D" />
```

## API

The package exports these names.

- `openScene({ source, provider, rootScenePath? })`: opens the text of a scene and returns a
  `Scene`. It parses the text once, the first time a view reads it.
- `Scene` (a type): an open scene. `setSource(text)` replaces its text, and every view of it draws
  the new text. `revision()` gives a number that changes with each change a view draws: a new text,
  a write or a load that changes the tree. `missingFiles()` gives the files its views asked for and
  did not get, see "Know which files are missing". `getNode`, `getNodeOrNull`, `load` and `observe`
  are in "Change the scene from your code". `dispose()` closes it.
- `NodeHandle` (a type): a node of a scene, which `getNode` gives. Its `call` is in "Set the
  camera".
- `variant(text)`: a value of any Godot type, as a `.tscn` file spells it. It throws for a text
  Godot cannot read.
- `Variant` and `SceneValue` (types): what `variant` gives, and what `get` and `set` take.
- `TscnCanvas`: the view. Its props are `scene` (a `Scene`, optional inside
  `<TscnSceneProvider>`), `mode` (`'in-game'`, `'3D'` or `'2D'`, default `'3D'`), `visible` (`false`
  stops the frames) and `className`.
- `TscnSceneProvider`: mounts what the view reads. Give it `scene` (a `Scene`), or `source` (the
  text of a `.tscn` scene), `provider` (a `ResourceProvider`) and `rootScenePath` (the `res://` path
  the scene opens under, optional). It takes `children`. A new `provider` starts a new resource
  loader.
- `ResourceProvider` (a type): `loadResource(path, type?)` returns the file as a string or an
  `ArrayBuffer`, or `null` when the file is missing.
- `useSelection`: the selected node path and the functions that change it. Call it in a component
  inside `<TscnSceneProvider>`.
- `useGameViewSettled()`: the settled value of the view below the same
  `<TscnSceneProvider>`, or `null` while it is pending. See "Know when the scene is whole".
- `mountScene(element, scene, options?)`: mounts the view with no React code of the page's own,
  and returns a `View`: `settled`, `captureImage`, `update` and `dispose`. See "Mount the view with
  no React code".
- `View` and `ViewOptions` (types): what `mountScene` returns, and the options of `mountScene` and
  `update`: `mode` (default `'in-game'`) and `visible` (default `true`).

## Styles and workers

The bundle adds one `<style>` element to the page when it loads. Your app needs no CSS-module
support and no stylesheet import. A page with a strict `style-src` policy must allow that element.

The renderer builds procedural textures, such as `NoiseTexture2D`, on the main thread. It starts no
worker.

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`. The build writes the notices from the
modules it bundles: the Godot Engine MIT notice covers the Godot code in the renderer, and the file
names the other third-party code it holds.
