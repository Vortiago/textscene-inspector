#!/usr/bin/env node
/**
 * Writes the template files of Godot's renderer at install: `node scripts/godot-templates/install.mjs
 * [--godot-source <dir>]`. It reads Godot's source when it finds one (scripts/godotSource.mjs),
 * keeps a file a CI job downloaded, and on Cloudflare Pages downloads the templates from GitHub.
 */

import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeGenerated } from '../generatedFile.mjs';
import { foundGodotSourceDir } from '../godotSource.mjs';
import { REPO_ROOT } from '../repoRoot.mjs';
import { CHECKSUMS_PATH, downloadTemplateTree } from './templateDownload.mjs';
import { renderTemplateFiles, TEMPLATE_FILES_PATH } from './templateFiles.mjs';

const TOOL = 'godot-template-files';

/**
 * Cloudflare Pages sets CF_PAGES=1 in its build (its build configuration docs). Only that build
 * downloads: anywhere else a missing source is a setup fault to name, not to hide.
 */
const isCloudflareBuild = () => process.env.CF_PAGES === '1';

function writeFrom(godotDir) {
  writeGenerated([[TEMPLATE_FILES_PATH, renderTemplateFiles(godotDir)]], { tool: TOOL });
}

async function writeFromGitHub() {
  const checksums = JSON.parse(readFileSync(CHECKSUMS_PATH, 'utf8'));
  const treeDir = mkdtempSync(join(tmpdir(), 'godot-templates-'));
  try {
    await downloadTemplateTree(checksums, treeDir);
    console.log(`[${TOOL}] downloaded Godot ${checksums.tag}'s template files from GitHub.`);
    writeFrom(treeDir);
  } finally {
    rmSync(treeDir, { recursive: true, force: true });
  }
}

/** Writes the file from the first way that `argv` and this machine allow. Throws when none does. */
export async function installTemplateFiles(argv) {
  const godotDir = foundGodotSourceDir(argv);
  if (godotDir) return writeFrom(godotDir);
  if (existsSync(TEMPLATE_FILES_PATH)) {
    console.log(`[${TOOL}] kept the file a job downloaded, as no Godot source is here.`);
    return;
  }
  if (isCloudflareBuild()) return writeFromGitHub();
  throw new Error(
    `expected Godot's source or ${relative(REPO_ROOT, TEMPLATE_FILES_PATH)}, found neither. The ` +
      "shader transpiler reads Godot's template files, which the repository does not hold. Run in " +
      'the CI image, pass --godot-source <dir> to this script, or download the godot-template-files ' +
      "artifact of a CI run into the file's folder."
  );
}

// `pathToFileURL`, not a `file://` template: on Windows `process.argv[1]` is a `C:\...` path.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await installTemplateFiles(process.argv);
}
