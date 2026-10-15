#!/usr/bin/env node
/**
 * Bakes Godot 4.7.2's two LTC tables for area lights, which Godot ships as DDS files
 * (`servers/rendering/storage/ltc/ltc_lut1.dds`, `ltc_lut2.dds`), into the committed
 * `ltcTable.generated.ts`: `node scripts/godot-ltc/bake-ltc.mjs [--check]`. A bake fetches each file at
 * the release tag. `--check` runs offline: it decodes the committed tables, checks them against
 * the pinned digests, renders them again and exits 1 on a difference.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO_ROOT } from '../repoRoot.mjs';

const OUT = join(REPO_ROOT, 'packages/textscene-core/src/godot/rendering/lights/ltcTable.generated.ts');

const SOURCE =
  'https://raw.githubusercontent.com/godotengine/godot/4.7.2-stable/servers/rendering/storage/ltc';

/** SHA-256 of each table's texels at the release tag, so a check needs no network. */
export const TEXEL_SHA256 = {
  'ltc_lut1.dds': 'c097ded563f9c13625acb1673e2ab6ffa590efcb954354f311e9d15a61d51dc3',
  'ltc_lut2.dds': '53f93b6a3c097b33be3a47d891cc6fb2b76635dff65cd7c78c01f291d280bc49',
};

/** `LTC_LUT_DIMENSIONS` (`make_ltc_lut.py:18`). */
export const LTC_SIZE = 64;

/** The DDS header and its DX10 extension, which `make_ltc_lut.py:4` skips. */
const HEADER_BYTES = 148;

/** `DXGI_FORMAT_R32G32B32A32_FLOAT`: Godot reads the texels as `Image::FORMAT_RGBAF`. */
const DXGI_RGBA32F = 2;

/** The texels of a DDS file: RGBA 32-bit floats, a row per view angle and a column per roughness. */
export function ltcTexels(dds) {
  const view = new DataView(dds.buffer, dds.byteOffset, dds.byteLength);
  const magic = String.fromCharCode(...dds.subarray(0, 4));
  const height = view.getUint32(12, true);
  const width = view.getUint32(16, true);
  const format = view.getUint32(128, true);
  if (magic !== 'DDS ' || width !== LTC_SIZE || height !== LTC_SIZE || format !== DXGI_RGBA32F) {
    throw new Error(
      `expected a ${LTC_SIZE}×${LTC_SIZE} RGBA32F DDS, got ${JSON.stringify(magic)} ${width}×${height} format ${format}`
    );
  }
  return dds.subarray(HEADER_BYTES, HEADER_BYTES + LTC_SIZE * LTC_SIZE * 16);
}

/** `texels` when they are the release's table `name`. Throws on any other bytes. */
function pinned(name, texels) {
  const digest = createHash('sha256').update(texels).digest('hex');
  if (digest !== TEXEL_SHA256[name]) {
    throw new Error(`expected ${name} texels with SHA-256 ${TEXEL_SHA256[name]}, got ${digest}`);
  }
  return texels;
}

async function fetchTexels(name) {
  const response = await fetch(`${SOURCE}/${name}`);
  if (!response.ok) throw new Error(`fetch ${name}: HTTP ${response.status}`);
  return pinned(name, ltcTexels(new Uint8Array(await response.arrayBuffer())));
}

/** The base64 the generated text assigns to `constant`, or an empty string when it has none. */
function base64Of(text, constant) {
  return text.match(new RegExp(`export const ${constant} =\\s*'([^']*)'`))?.[1] ?? '';
}

/**
 * The problem with a committed generated `text`, or null when it holds the release's tables in the
 * bake's exact form.
 */
export function generatedProblem(text) {
  try {
    const lut1 = pinned('ltc_lut1.dds', Buffer.from(base64Of(text, 'LTC_LUT1_BASE64'), 'base64'));
    const lut2 = pinned('ltc_lut2.dds', Buffer.from(base64Of(text, 'LTC_LUT2_BASE64'), 'base64'));
    return render(lut1, lut2) === text ? null : 'its text differs from a fresh bake';
  } catch (error) {
    return error.message;
  }
}

function render(lut1, lut2) {
  return `/**
 * Godot 4.7.2's LTC tables for area lights (\`servers/rendering/storage/ltc/ltc_lut1.dds\`, \`ltc_lut2.dds\`),
 * in the 32-bit floats Godot stores them in. Eric Heitz fitted the tables.
 * AUTO-GENERATED - Do not edit manually. Run: pnpm godot:ltc
 */

/*
 * The tables come from Godot Engine, used under the MIT licence:
 *
 *   Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md).
 *   Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 *
 * See THIRD-PARTY-NOTICES.md for the full notice.
 */

/** The tables' width and height (\`make_ltc_lut.py:18\`). */
export const LTC_SIZE = ${LTC_SIZE};

/**
 * Base64 of the little-endian floats: RGBA per texel, a row per view angle and a column per
 * roughness. Each texel holds the fit's matrix entries \`a, b, c, d\`.
 */
export const LTC_LUT1_BASE64 =
  '${Buffer.from(lut1).toString('base64')}';

/** The same layout, each texel holding the fit's \`e\` and its two Fresnel weights. */
export const LTC_LUT2_BASE64 =
  '${Buffer.from(lut2).toString('base64')}';
`;
}

async function bake() {
  const [lut1, lut2] = await Promise.all([fetchTexels('ltc_lut1.dds'), fetchTexels('ltc_lut2.dds')]);
  writeFileSync(OUT, render(lut1, lut2));
}

function check() {
  const problem = generatedProblem(readFileSync(OUT, 'utf8'));
  if (problem === null) return;
  console.error(`${OUT} is stale: ${problem}. Run: pnpm godot:ltc`);
  process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes('--check')) check();
  else await bake();
}
