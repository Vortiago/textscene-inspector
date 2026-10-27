/**
 * Writes `gltfImportScene.godot.json`: the scene Godot's importer builds from each glTF in
 * `cases.mjs`, over every naming version and both `nodes/import_as_skeleton_bones` values.
 *
 *   node measure.mjs [--godot /usr/local/bin/godot]
 *
 * It imports the files through `godot --headless --import` in a scratch project, so the editor
 * importer's own post-processing runs, then lists each node with `dump.gd`.
 */

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { CASES, CORPUS } from './cases.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPOSITORY = resolve(HERE, '../../../../../../..');
const OUTPUT = resolve(HERE, '../../gltfImportScene.godot.json');
const NAMING_VERSIONS = [0, 1, 2];
const TRIANGLE = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);

function godotBinary() {
  const flag = process.argv.indexOf('--godot');
  return flag === -1 ? 'godot' : process.argv[flag + 1];
}

function padded(bytes, fill) {
  const out = new Uint8Array(Math.ceil(bytes.length / 4) * 4).fill(fill);
  out.set(bytes);
  return out;
}

function chunk(type, bytes) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(bytes.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, bytes]);
}

/** A binary glTF of `json` over the triangle every node list draws. */
function glbOf(json) {
  const body = Buffer.concat([
    chunk('JSON', padded(Buffer.from(JSON.stringify(json)), 0x20)),
    chunk('BIN\0', Buffer.from(TRIANGLE.buffer)),
  ]);
  const header = Buffer.alloc(12);
  header.write('glTF', 0, 'latin1');
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + body.length, 8);
  return Buffer.concat([header, body]);
}

function jsonOf(glb) {
  return JSON.parse(glb.subarray(20, 20 + glb.readUInt32LE(12)).toString('utf8'));
}

/** `json` with only what the importer's naming and placement read, so the file stays small. */
function reduced(json) {
  const sized = (list) => (Array.isArray(list) ? list.map(() => ({})) : undefined);
  return {
    scene: json.scene,
    scenes: json.scenes,
    extensionsUsed: json.extensionsUsed,
    nodes: json.nodes?.map(({ name, children, mesh, skin, camera, extensions }) => ({
      name,
      children,
      mesh,
      skin,
      camera,
      extensions,
    })),
    skins: json.skins?.map(({ joints }) => ({ joints })),
    meshes: json.meshes?.map(({ name }) => ({ name })),
    animations: json.animations?.map(({ name, channels, samplers }) => ({
      name,
      channels: sized(channels),
      samplers: sized(samplers),
    })),
  };
}

const importFile = (namingVersion, importAsSkeletonBones) => `[remap]

importer="scene"
type="PackedScene"

[params]

nodes/import_as_skeleton_bones=${importAsSkeletonBones}
gltf/naming_version=${namingVersion}
`;

function writeProject(directory, models) {
  writeFileSync(
    join(directory, 'project.godot'),
    'config_version=5\n\n[application]\nconfig/name="gltf-scene-paths"\n'
  );
  copyFileSync(join(HERE, 'dump.gd'), join(directory, 'dump.gd'));
  const imports = [];
  for (const { name, glb } of models) {
    for (const namingVersion of NAMING_VERSIONS) {
      for (const importAsSkeletonBones of [false, true]) {
        const file = `${name}_n${namingVersion}_${importAsSkeletonBones ? 'bones' : 'nobones'}`;
        writeFileSync(join(directory, `${file}.glb`), glb);
        writeFileSync(
          join(directory, `${file}.glb.import`),
          importFile(namingVersion, importAsSkeletonBones)
        );
        imports.push({ name, file, namingVersion, importAsSkeletonBones });
      }
    }
  }
  return imports;
}

function dumpScenes(godot, directory) {
  execFileSync(godot, ['--headless', '--path', directory, '--import'], { stdio: 'ignore' });
  const output = execFileSync(godot, ['--headless', '--path', directory, '-s', 'dump.gd'], {
    encoding: 'utf8',
  });
  return JSON.parse(output.split('\n').findLast((line) => line.startsWith('{')));
}

const nodeRow = ({ path, type, bone }) => (bone === undefined ? [path, type] : [path, type, bone]);

const models = [
  ...CASES.map(({ name, gltf }) => ({ name, glb: glbOf(gltf) })),
  ...CORPUS.map(({ name, source }) => ({ name, source, glb: readFileSync(join(REPOSITORY, source)) })),
];
const directory = mkdtempSync(join(tmpdir(), 'gltf-scene-paths-'));
try {
  const imports = writeProject(directory, models);
  const scenes = dumpScenes(godotBinary(), directory);
  const version = execFileSync(godotBinary(), ['--version'], { encoding: 'utf8' }).trim();
  const measured = {
    godot: version,
    models: models.map(({ name, source, glb }) => ({
      name,
      ...(source && { source }),
      gltf: reduced(jsonOf(glb)),
      imports: imports
        .filter((entry) => entry.name === name)
        .map(({ file, namingVersion, importAsSkeletonBones }) => ({
          file,
          namingVersion,
          importAsSkeletonBones,
          nodes: scenes[`${file}.glb`].map(nodeRow),
        })),
    })),
  };
  writeFileSync(OUTPUT, `${JSON.stringify(measured, null, 2)}\n`);
} finally {
  rmSync(directory, { recursive: true, force: true });
}
