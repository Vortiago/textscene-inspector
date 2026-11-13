/**
 * A plain three.js page as a user of the package builds one: the packed tarball installed beside
 * three.js alone, no bundler and no React, and an import map that names the two packages. The
 * integration and end to end layers draw on such a page, in the browser that measures against
 * Godot, so a bundle that leans on the workspace fails there.
 */

import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';
import { installedVersion, packTarball, run } from '../../../scripts/packTarball.mjs';
import { REPO_ROOT } from '../../../scripts/repoRoot.mjs';
import { launchGodotComparisonBrowser } from '../../../scripts/showcase/browser.mjs';
import { previewPort } from '../../../scripts/visual/preview/ports.mjs';

const PACKAGE_DIR = join(REPO_ROOT, 'apps/textscene-three-godot-shaders');

/** Software GL compiles the first program slowly, and a page that fails to import never starts. */
const PAGE_START_TIMEOUT_MS = 60_000;

/** The import map of every page: the package and three.js, each from its installed files. */
export const IMPORT_MAP = {
  imports: {
    three: '/node_modules/three/build/three.module.js',
    'three/webgpu': '/node_modules/three/build/three.webgpu.js',
    'three/tsl': '/node_modules/three/build/three.tsl.js',
    'three/addons/': '/node_modules/three/examples/jsm/',
    '@textscene/three-godot-shaders': '/node_modules/@textscene/three-godot-shaders/dist/index.js',
  },
};

/** The page's HTML: the import map, then `module` as the page's one script. */
export function pageHtml(module) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <script type="importmap">${JSON.stringify(IMPORT_MAP)}</script>
    <script type="module" src="./${module}"></script>
  </head>
  <body></body>
</html>
`;
}

/**
 * Builds and packs the package, and installs the tarball and three.js into a new directory, with
 * the files of `pageDir` beside them. The caller removes the directory.
 */
export function installConsumer(pageDir) {
  run('pnpm', ['--filter', '@textscene/three-godot-shaders', 'build'], REPO_ROOT);
  const directory = mkdtempSync(join(tmpdir(), 'shaders-page-'));
  const tarball = packTarball(PACKAGE_DIR, directory);
  const manifest = {
    name: 'plain-three-page',
    private: true,
    type: 'module',
    dependencies: { three: installedVersion('three', 'apps/textscene-three-godot-shaders') },
  };
  writeFileSync(join(directory, 'package.json'), JSON.stringify(manifest));
  run('npm', ['install', '--no-audit', '--no-fund', tarball], directory);
  cpSync(pageDir, directory, { recursive: true });
  return directory;
}

const CONTENT_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
};

/** Serves `directory` as static files on `harness`'s port, and answers the server and its URL. */
export async function serveDirectory(directory, harness) {
  const { port } = previewPort(harness);
  const root = resolve(directory);
  const server = createServer((request, response) => {
    const path = normalize(join(root, decodeURIComponent(new URL(request.url, 'http://page').pathname)));
    if (!path.startsWith(root)) {
      response.writeHead(403).end();
      return;
    }
    try {
      const body = readFileSync(path);
      response.writeHead(200, { 'content-type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      // A missing file is the page's error, which the browser reports.
      response.writeHead(404).end();
    }
  });
  await new Promise((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));
  return { server, url: `http://127.0.0.1:${port}` };
}

/**
 * Runs `work(page)` on the page `module` of an installed consumer, in the browser that measures
 * against Godot, and closes everything after. Page errors fail the run.
 */
export async function withConsumerPage({ pageDir, module, harness }, work) {
  const directory = installConsumer(pageDir);
  writeFileSync(join(directory, 'index.html'), pageHtml(module));
  const { server, url } = await serveDirectory(directory, harness);
  const browser = await launchGodotComparisonBrowser();
  const errors = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto(`${url}/index.html`);
    try {
      await page.waitForFunction(() => globalThis.pageReady === true, null, {
        timeout: PAGE_START_TIMEOUT_MS,
      });
    } catch (error) {
      throw new Error(`the page did not start: ${errors.join('; ') || error.message}`, { cause: error });
    }
    return await work(page, errors);
  } finally {
    await browser.close();
    await new Promise((resolveClose) => server.close(resolveClose));
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Appends `markdown` to the job summary when CI gives one. */
export function writeJobSummary(markdown) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) writeFileSync(summary, `${markdown}\n`, { flag: 'a' });
}
