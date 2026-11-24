import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';

export const CORE_SOURCE = 'packages/textscene-core/src/';

// Lowest first (ADR-0092). `/` ends a folder, `*/` names each subfolder. A module on no path is in layer 0.
export const LAYERS = [
  { name: 'Scene and View', paths: [] },
  { name: 'Editor view', paths: ['r3f/editorView/'] },
  { name: 'Renderer entry', paths: ['r3f/TscnCanvas.tsx', 'r3f/mountScene.tsx', 'r3f/renderer.ts'] },
  { name: 'Previewer', paths: ['r3f/components/*/'] },
  { name: 'Core entry', paths: ['index.ts', 'r3f/index.ts'] },
];

const withoutExtension = (path) => path.replace(/\.(?:[cm]?js|jsx|tsx?)$/, '');

const FOLDERS = LAYERS.flatMap((layer, index) =>
  layer.paths.filter((path) => path.endsWith('/')).map((folder) => ({ folder, index }))
);
const FILES = new Map(
  LAYERS.flatMap((layer, index) =>
    layer.paths.filter((path) => !path.endsWith('/')).map((file) => [withoutExtension(file), index])
  )
);

const isDirectory = (corePath) =>
  statSync(`${REPO_ROOT}/${CORE_SOURCE}${corePath}`, { throwIfNoEntry: false })?.isDirectory();

// Whether `asFolder` is in `folder`. A `*/` folder holds only what sits in one of its subfolders.
function isInFolder(asFolder, folder) {
  if (!folder.endsWith('*/')) return asFolder.startsWith(folder);
  const parent = folder.slice(0, -2);
  if (!asFolder.startsWith(parent)) return false;
  const subfolder = asFolder.slice(parent.length).split('/')[0];
  return subfolder !== '' && isDirectory(`${parent}${subfolder}`) === true;
}

/** The layer of `corePath`, a path from core's `src/`, as a file or as a folder's index. */
function layerIndexOf(corePath) {
  const path = withoutExtension(corePath);
  const asFolder = path === '' ? '' : `${path}/`;
  return (
    FILES.get(path) ??
    FILES.get(`${asFolder}index`) ??
    FOLDERS.find(({ folder }) => isInFolder(asFolder, folder))?.index ??
    0
  );
}

/** Null outside core. From the repo root, not ESLint's cwd, which a package-folder run moves. */
function corePathOf(file) {
  const fromRoot = relative(REPO_ROOT, file).replaceAll('\\', '/');
  if (`${fromRoot}/` === CORE_SOURCE) return '';
  return fromRoot.startsWith(CORE_SOURCE) ? fromRoot.slice(CORE_SOURCE.length) : null;
}

const importDown = {
  meta: {
    type: 'problem',
    docs: { description: 'A module of core imports only from its own layer and the layers below it.' },
    messages: {
      upward:
        "The {{from}} layer imports the {{to}} layer through '{{specifier}}'. A layer imports only from itself and the layers below it (ADR-0092).",
    },
    schema: [],
  },
  create(context) {
    const importer = corePathOf(context.filename);
    if (importer === null) return {};
    const from = layerIndexOf(importer);
    const check = (source) => {
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
      if (!source.value.startsWith('.')) return;
      const target = corePathOf(resolve(dirname(context.filename), source.value));
      if (target === null) return;
      const to = layerIndexOf(target);
      if (to <= from) return;
      context.report({
        node: source,
        messageId: 'upward',
        data: { from: LAYERS[from].name, to: LAYERS[to].name, specifier: source.value },
      });
    };
    return {
      'ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration, ImportExpression': (node) =>
        check(node.source),
      TSImportType: (node) => check(node.source ?? node.argument?.literal),
      'TSImportEqualsDeclaration > TSExternalModuleReference': (node) => check(node.expression),
    };
  },
};

/** The version is a hash of the table, so ESLint's cache lints again when a layer changes. */
export const layersPlugin = {
  meta: {
    name: 'layers',
    version: createHash('sha256').update(JSON.stringify(LAYERS)).digest('hex').slice(0, 12),
  },
  rules: { 'import-down': importDown },
};
