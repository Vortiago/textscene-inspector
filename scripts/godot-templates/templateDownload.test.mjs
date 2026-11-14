import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { downloadTemplateTree, godotTag, templateUrl } from './templateDownload.mjs';

const VERSION_PY = 'major = 4\nminor = 6\npatch = 3\nstatus = "stable"\n';
const SKY = 'void main() {}\n';
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

const CHECKSUMS = {
  tag: '4.6.3-stable',
  files: {
    'version.py': sha256(VERSION_PY),
    'servers/rendering/renderer_rd/shaders/environment/sky.glsl': sha256(SKY),
  },
};

/** A fetch that serves `served` by URL, as GitHub serves Godot's tree. */
const fetchFrom = (served) => async (url) => {
  if (!(url in served)) throw new Error(`no file at ${url}`);
  return Buffer.from(served[url]);
};

const servedTree = (sky = SKY) => ({
  [templateUrl('4.6.3-stable', 'version.py')]: VERSION_PY,
  [templateUrl('4.6.3-stable', 'servers/rendering/renderer_rd/shaders/environment/sky.glsl')]: sky,
});

describe('godotTag', () => {
  it("reads Godot's release tag from version.py", () => {
    expect(godotTag(VERSION_PY)).toBe('4.6.3-stable');
  });
});

describe('templateUrl', () => {
  it("names the file in Godot's GitHub tree at the tag", () => {
    expect(templateUrl('4.6.3-stable', 'version.py')).toBe(
      'https://raw.githubusercontent.com/godotengine/godot/4.6.3-stable/version.py'
    );
  });
});

describe('downloadTemplateTree', () => {
  let outDir;
  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), 'templates-'));
  });
  afterEach(() => rmSync(outDir, { recursive: true, force: true }));

  it("writes each file at its path in Godot's tree", async () => {
    await downloadTemplateTree(CHECKSUMS, outDir, fetchFrom(servedTree()));
    expect(readFileSync(join(outDir, 'version.py'), 'utf8')).toBe(VERSION_PY);
    expect(
      readFileSync(join(outDir, 'servers/rendering/renderer_rd/shaders/environment/sky.glsl'), 'utf8')
    ).toBe(SKY);
  });

  it('refuses a file whose checksum differs, naming the file and both sums', async () => {
    const changed = 'void main() { discard; }\n';
    await expect(downloadTemplateTree(CHECKSUMS, outDir, fetchFrom(servedTree(changed)))).rejects.toThrow(
      `expected sha256 ${sha256(SKY)} for servers/rendering/renderer_rd/shaders/environment/sky.glsl at ` +
        `4.6.3-stable, got ${sha256(changed)}`
    );
  });
});
