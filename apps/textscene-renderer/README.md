# @textscene/renderer

`@textscene/renderer` draws a parsed Godot `.tscn` scene in a React app. It is the renderer of the
[TextScene Inspector](https://github.com/Vortiago/textscene-inspector): a react-three-fiber canvas,
bundled into one ES module. React and three.js are peer dependencies, so your app keeps one copy of
each.

The package is not a 1:1 copy of Godot. Each node type has a comparison sheet that lists what the
renderer supports and where it differs from Godot 4.6. The
[index of the sheets](https://github.com/Vortiago/textscene-inspector/blob/main/docs/comparison/README.md)
links every one of them.

## Install

```bash
npm install @textscene/renderer @textscene/tscn react react-dom three @react-three/fiber @react-three/drei @react-three/postprocessing postprocessing
```

`@textscene/tscn` is the parser. The renderer takes the scene it returns. The peer dependencies are
`react`, `react-dom`, `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
and `postprocessing`. `package.json` names the supported versions. The renderer patches three.js
shaders, so a `three` version outside that range can draw wrongly.

## Use

```tsx
import { TscnParser } from '@textscene/tscn';
import { TscnCanvas, TscnSceneProvider, type ResourceProvider } from '@textscene/renderer';

const scene = new TscnParser().parse(source);

// Loads a scene's `res://` files: text for a text file, bytes for any other file, null for a miss.
const provider: ResourceProvider = {
  async loadResource(path) {
    const response = await fetch(`/game/${path.slice('res://'.length)}`);
    if (!response.ok) return null;
    return /\.(tscn|tres)$/.test(path) ? response.text() : response.arrayBuffer();
  },
};

export function SceneView() {
  return (
    <TscnSceneProvider scene={scene} provider={provider}>
      <div style={{ width: 640, height: 480 }}>
        <TscnCanvas />
      </div>
    </TscnSceneProvider>
  );
}
```

`<TscnCanvas>` fills its parent, so give the parent a size.

## API

The package exports four names.

- `TscnCanvas`: the canvas. It reads the scene, the resources and the selection from
  `<TscnSceneProvider>`.
- `TscnSceneProvider`: mounts what the canvas reads. Its props are `scene` (a parsed scene),
  `provider` (a `ResourceProvider`), `rootScenePath` (the `res://` path the scene opens under, optional)
  and `children`. A new `provider` starts a new resource loader.
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
