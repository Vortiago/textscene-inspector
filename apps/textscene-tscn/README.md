# @textscene/tscn

`@textscene/tscn` parses Godot `.tscn` scenes. It is the parser of the
[TextScene Inspector](https://github.com/Vortiago/textscene-inspector), bundled into one ES module
with no dependency, no peer dependency, no React and no three.js. It runs in Node and in a browser.

The parser reads the current `.tscn` format (`format=3`). The repository's
[glossary](https://github.com/Vortiago/textscene-inspector/blob/main/GLOSSARY.md) defines the format's terms,
and [REFERENCES.md](https://github.com/Vortiago/textscene-inspector/blob/main/REFERENCES.md) links Godot's
format documentation.

## Install

```bash
npm install @textscene/tscn
```

## Use

```ts
import { TscnParser } from '@textscene/tscn';

const scene = new TscnParser().parse(source);
console.log(scene.nodes[0]?.name);
```

The package exports `TscnParser` and the types of the scene it returns: `TscnScene`, `TscnNode`,
`RawNode`, `TscnExternalResource`, `TscnInternalResource` and `TscnMainResource`.

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`. The build writes the notices from the
modules it bundles: the Godot Engine MIT notice covers the Godot code in the parser.
