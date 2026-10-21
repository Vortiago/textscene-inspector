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

The package also exports the Godot engine facts the parser shares with the previewer:
`PROJECT_FILE_NAME`, `PROJECT_FILE_PATH`, `SCAN_STOP_FILES`, `isScannedPath`, `importSidecarPath` and
`isGodotTextResourcePath`.

## Licence

MIT. The package ships `LICENSE` and `THIRD-PARTY-NOTICES.md`, which holds the notices of the
third-party code the repository transcribes, the Godot Engine MIT notice among them.
