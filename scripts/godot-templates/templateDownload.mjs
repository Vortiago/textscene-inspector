import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { godotVersion } from '../godot-shader-language/readSource.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { TEMPLATE_DIR, templateFileNames } from './templateFiles.mjs';

export const CHECKSUMS_PATH = join(REPO_ROOT, 'scripts/godot-templates/templateChecksums.generated.json');

const GODOT_RAW_URL = 'https://raw.githubusercontent.com/godotengine/godot';

/** Godot's release tag, such as `4.6.3-stable`, from the text of its `version.py`. */
export function godotTag(versionPy) {
  const status = /^status = "(\w+)"$/m.exec(versionPy);
  if (!status) throw new Error('expected status = "<word>" in version.py, found none');
  return `${godotVersion(versionPy)}-${status[1]}`;
}

export function templateUrl(tag, path) {
  return `${GODOT_RAW_URL}/${tag}/${path}`;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** The paths of Godot's tree that the template file reads: `version.py` and each template. */
function treePaths(godotDir) {
  return [
    'version.py',
    ...templateFileNames(join(godotDir, TEMPLATE_DIR)).map((file) => `${TEMPLATE_DIR}/${file}`),
  ];
}

/** The checksums file for Godot's tree at `godotDir`: its tag and the sha256 of each path it reads. */
export function renderChecksums(godotDir) {
  const files = Object.fromEntries(
    treePaths(godotDir).map((path) => [path, sha256(readFileSync(join(godotDir, path)))])
  );
  const tag = godotTag(readFileSync(join(godotDir, 'version.py'), 'utf8'));
  return `${JSON.stringify({ tag, files }, null, 2)}\n`;
}

/** The bytes at `url`. Throws, naming the status, on a response that is not OK. */
export async function fetchBytes(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`expected ${url} to answer 200, got ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Writes each file of `checksums` into `outDir` at its path in Godot's tree, from `fetchFile`. Throws,
 * naming the file and both sums, on a file whose sha256 differs, so a moved tag fails the build.
 */
export async function downloadTemplateTree(checksums, outDir, fetchFile = fetchBytes) {
  const { tag, files } = checksums;
  await Promise.all(
    Object.entries(files).map(async ([path, expected]) => {
      const bytes = await fetchFile(templateUrl(tag, path));
      const found = sha256(bytes);
      if (found !== expected)
        throw new Error(`expected sha256 ${expected} for ${path} at ${tag}, got ${found}`);
      mkdirSync(dirname(join(outDir, path)), { recursive: true });
      writeFileSync(join(outDir, path), bytes);
    })
  );
}
