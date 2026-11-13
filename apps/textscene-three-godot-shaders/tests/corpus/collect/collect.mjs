#!/usr/bin/env node
/**
 * Collects the corpus of real shaders: `pnpm shaders:corpus`. It writes each whole shader to
 * `tests/corpus/shaders/` and the list of them, with source and licence, to `corpus.json`:
 * the text Godot's material generators write over their flag sweeps, the shaders of the demo
 * projects and the documentation at pinned commits, this repository's fixtures, and one
 * rejected shader made by one change to each valid one. It needs Godot, xvfb and git.
 */

import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { REPO_ROOT } from '../../../../../scripts/repoRoot.mjs';
import { fetchShallow } from '../../../../../scripts/vendor-git.mjs';
import { docsShaders, inlineShaders, oneChange } from './corpusSources.mjs';
import { generatorShaders } from './generatorShaders.mjs';

const CORPUS_DIR = join(REPO_ROOT, 'apps/textscene-three-godot-shaders/tests/corpus');
const SHADERS_DIR = join(CORPUS_DIR, 'shaders');

/** The repositories read, each at one commit so a run collects the same text. */
const REPOSITORIES = {
  demos: {
    url: 'https://github.com/godotengine/godot-demo-projects',
    commit: 'b761b4cd5718a7118f2c95eb55f181d0a5f004f1',
    licence: 'MIT, godotengine/godot-demo-projects LICENSE.md',
  },
  docs: {
    url: 'https://github.com/godotengine/godot-docs',
    commit: 'c5b3485cb4b6e14ae3d8a45271bcddac7caad66a',
    licence: 'CC BY 3.0, godotengine/godot-docs LICENSE.txt',
  },
};

const GENERATOR_LICENCE = 'MIT, Godot Engine 4.6.3: the text its material generator writes';
const FIXTURE_LICENCE = 'MIT, this repository';

/** The directories of this repository whose shaders join the corpus. */
const FIXTURE_DIRS = ['scenes/fixtures'];

/** A shallow copy of `repository` at its commit, with no `.git`, in a new directory the caller removes. */
function checkout({ url, commit }) {
  const directory = mkdtempSync(join(tmpdir(), 'shader-corpus-'));
  fetchShallow(url, commit, directory);
  return directory;
}

function filesUnder(directory, pattern) {
  return readdirSync(directory, { recursive: true })
    .filter((path) => pattern.test(path))
    .sort();
}

/** The shaders of a project: each `.gdshader` file, and each Shader written inside a scene or resource. */
function projectShaders(root, prefix, licence, source) {
  const shader = (id, text, path) => ({ id, text, source: { ...source, path }, licence });
  const files = filesUnder(root, /\.gdshader$/).map((path) =>
    shader(`${prefix}/${path}`, readFileSync(join(root, path), 'utf8'), path)
  );
  const inline = filesUnder(root, /\.(tscn|tres)$/).flatMap((path) =>
    inlineShaders(readFileSync(join(root, path), 'utf8')).map((text, index) =>
      shader(`${prefix}/${path}#${index}`, text, path)
    )
  );
  return [...files, ...inline];
}

function docsCorpus(root) {
  const { url, commit, licence } = REPOSITORIES.docs;
  return filesUnder(root, /^tutorials\/shaders\/.*\.rst$/).flatMap((path) =>
    docsShaders(readFileSync(join(root, path), 'utf8')).map(({ index, text }) => ({
      id: `docs/${path}#${index}`,
      text,
      source: { repository: url, commit, path, block: index },
      licence,
    }))
  );
}

function generatorCorpus() {
  return generatorShaders().map((shader) => {
    const setting = shader.property ? `${shader.property}=${shader.value}` : 'defaults';
    return {
      id: `generator/${shader.class}/${setting}`,
      text: shader.code,
      source: {
        generator: shader.class,
        property: shader.property || undefined,
        value: shader.value ?? undefined,
      },
      licence: GENERATOR_LICENCE,
    };
  });
}

/** The valid shaders, each text once: a text two sources hold stays with the first. */
function validShaders() {
  const demos = checkout(REPOSITORIES.demos);
  const docs = checkout(REPOSITORIES.docs);
  try {
    const { url, commit, licence } = REPOSITORIES.demos;
    const shaders = [
      ...generatorCorpus(),
      ...projectShaders(demos, 'demos', licence, { repository: url, commit }),
      ...docsCorpus(docs),
      ...FIXTURE_DIRS.flatMap((dir) => projectShaders(join(REPO_ROOT, dir), dir, FIXTURE_LICENCE, {})),
    ];
    const seen = new Set();
    return shaders.filter(({ text }) => !seen.has(text) && seen.add(text));
  } finally {
    rmSync(demos, { recursive: true, force: true });
    rmSync(docs, { recursive: true, force: true });
  }
}

const shaderType = (text) => /^\s*shader_type\s+(\w+)\s*;/m.exec(text)?.[1] ?? 'none';

/** The file of a shader's text: its id, with the characters a path cannot hold replaced. */
const fileOf = (id) =>
  `${id.replace(/\.(gdshader|tscn|tres|rst)(#|$)/, '$2').replace(/[#=]/g, '-')}.gdshader`;

function main() {
  const valid = validShaders();
  const typed = valid.map((shader) => ({ ...shader, shaderType: shaderType(shader.text) }));
  // A rejected shader keeps its origin's type: a change can break the `shader_type` line.
  const rejected = typed.map((shader, index) => {
    const { change, text } = oneChange(shader.text, index);
    return { ...shader, id: `rejected/${shader.id}`, text, changedFrom: shader.id, change };
  });
  rmSync(SHADERS_DIR, { recursive: true, force: true });
  const idOfFile = new Map();
  const entries = [...typed, ...rejected].map(({ text, ...shader }) => {
    const file = fileOf(shader.id);
    // `fileOf` maps `a.tscn#0` and `a.tres#0` to one file: the second would overwrite the first.
    if (idOfFile.has(file)) {
      throw new Error(`expected one shader per file, got ${idOfFile.get(file)} and ${shader.id} in ${file}`);
    }
    idOfFile.set(file, shader.id);
    mkdirSync(dirname(join(SHADERS_DIR, file)), { recursive: true });
    writeFileSync(join(SHADERS_DIR, file), text);
    return { ...shader, file };
  });
  writeFileSync(join(CORPUS_DIR, 'corpus.json'), `${JSON.stringify(entries, null, 1)}\n`);
  console.log(
    `[shader-corpus] ${valid.length} shaders and ${rejected.length} with one change, in ${relative(REPO_ROOT, SHADERS_DIR)}`
  );
}

main();
