import { dirname, relative, resolve } from 'node:path';

export const CORE_SOURCE = 'packages/textscene-core/src/';

/** Lowest first (ADR-0092). A path ending in `/` is a folder. A module on no path is in the first layer. */
export const LAYERS = [
  { name: 'Scene and View', paths: [] },
  { name: 'Editor view', paths: ['r3f/editorView/'] },
  { name: 'Renderer entry', paths: ['r3f/TscnCanvas.tsx', 'r3f/mountScene.tsx', 'r3f/renderer.ts'] },
  {
    name: 'Previewer',
    paths: [
      'r3f/components/AnimationPanel/',
      'r3f/components/MissingResourcesPanel/',
      'r3f/components/NodeDetailsPanel/',
      'r3f/components/SceneLoadBanner/',
      'r3f/components/SceneTreeViewer/',
      'r3f/components/Splitter/',
      'r3f/components/TscnPreviewShell/',
      'r3f/components/ViewportControlsHelp/',
      'r3f/components/ViewportToolbar/',
    ],
  },
  { name: 'Core entry', paths: ['index.ts', 'r3f/index.ts'] },
];

const withoutExtension = (path) => path.replace(/\.(?:[cm]?js|jsx|tsx?)$/, '');

/** The index of the layer that holds `corePath`, a path from core's `src/`. */
function layerIndexOf(corePath) {
  const path = withoutExtension(corePath);
  const index = LAYERS.findIndex((layer) =>
    layer.paths.some((entry) =>
      entry.endsWith('/') ? `${path}/`.startsWith(entry) : path === withoutExtension(entry)
    )
  );
  return Math.max(index, 0);
}

/** The path from core's `src/` of `file`, or null for a file outside core. */
function corePathOf(file, cwd) {
  const fromRoot = relative(cwd, file).replaceAll('\\', '/');
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
    const importer = corePathOf(context.filename, context.cwd);
    if (importer === null) return {};
    const from = layerIndexOf(importer);
    const check = (source) => {
      if (source?.type !== 'Literal' || typeof source.value !== 'string') return;
      if (!source.value.startsWith('.')) return;
      const target = corePathOf(resolve(dirname(context.filename), source.value), context.cwd);
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
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
    };
  },
};

export const layersPlugin = { rules: { 'import-down': importDown } };
