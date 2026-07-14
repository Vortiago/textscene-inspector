/**
 * Helpers for dependency-chain hot-reload integration tests.
 *
 * Sets up a small self-contained Godot project inside `.test-workspace/dep-chain/`
 * with a three-level dependency chain:
 *
 *   main.tscn -> sub.tscn -> texture.png      (three layers)
 *   main.tscn -> material.tres -> texture.png  (second chain through material)
 *
 * The helpers here build the directory, write the fixture files with real
 * content, and expose typed paths so test files never hard-code strings.
 *
 * Also exposed: `primePanelForDepChain`, which fires the `loadResource`
 * messages that the webview sends when it encounters external resource
 * references. This is required before `handleDependencyChange` can resolve
 * a file to its `res://` path: the served-resources map inside
 * `VSCodeResourceProvider` is empty until a `loadResource` call populates it.
 */

import * as path from 'path';
import * as fs from 'fs';
import type { HostToWebviewMessage } from '../../../protocol';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/**
 * Return the absolute fsPath for the dep-chain workspace directory.
 * Resolves from `__dirname` (compiled: `dist/test/integration/helpers/`) up
 * to the vscode-app root, then into `.test-workspace/dep-chain`.
 */
export function depChainDir(): string {
  return path.resolve(__dirname, '../../../../.test-workspace/dep-chain');
}

/** Absolute path to the main entry scene. */
export function mainTscnPath(): string {
  return path.join(depChainDir(), 'main.tscn');
}

/** Absolute path to the instanced sub-scene. */
export function subTscnPath(): string {
  return path.join(depChainDir(), 'sub.tscn');
}

/** Absolute path to the shared material file. */
export function materialTresPath(): string {
  return path.join(depChainDir(), 'material.tres');
}

/** Absolute path to the shared texture. */
export function texturePngPath(): string {
  return path.join(depChainDir(), 'texture.png');
}

/** Absolute path to an unrelated scene that main.tscn does NOT reference. */
export function unrelatedTscnPath(): string {
  return path.join(depChainDir(), 'unrelated.tscn');
}

// res:// paths (Godot canonical) — depth-layer reference keys.
/** Deepest layer: a texture referenced by sub.tscn, material.tres, and main.tscn. */
export const RES_TEXTURE = 'res://texture.png';
/** Middle layer: a material file referenced by main.tscn. */
export const RES_MATERIAL = 'res://material.tres';
/** First layer: an instanced sub-scene referenced by main.tscn. */
export const RES_SUB = 'res://sub.tscn';

// ---------------------------------------------------------------------------
// Workspace setup / teardown
// ---------------------------------------------------------------------------

/** Minimal valid 1x1 PNG bytes so binary resource reads succeed. */
function fakePngBytes(): Uint8Array {
  return new Uint8Array([
    // PNG signature
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    // IHDR chunk (13 bytes)
    0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, 0x02,             // bit depth: 8, colour type: 2 (RGB)
    0x00, 0x00, 0x00,       // compression, filter, interlace
    0x90, 0x77, 0x53, 0xde, // CRC
    // IDAT chunk
    0x00, 0x00, 0x00, 0x0c,
    0x49, 0x44, 0x41, 0x54,
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01,
    0xe2, 0x21, 0xbc, 0x33, // CRC
    // IEND chunk
    0x00, 0x00, 0x00, 0x00,
    0x49, 0x45, 0x4e, 0x44,
    0xae, 0x42, 0x60, 0x82, // CRC
  ]);
}

/**
 * Write fixture files for the dependency chain into `.test-workspace/dep-chain/`.
 *
 * Call once in the suite's `suiteSetup`. The directory is recreated from
 * scratch so each run is hermetic.
 *
 * Dependency graph:
 *   main.tscn       --[PackedScene]--> sub.tscn
 *                   --[Texture2D]----> texture.png
 *                   --[Material]------> material.tres
 *   sub.tscn        --[Texture2D]----> texture.png
 *   material.tres   --[Texture2D]----> texture.png
 *   unrelated.tscn  -- (no shared references)
 */
export function setupDepChainWorkspace(): void {
  const dir = depChainDir();

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });

  // project.godot — presence makes findGodotProjectRoot stop here.
  fs.writeFileSync(
    path.join(dir, 'project.godot'),
    '; Godot Project Configuration\nconfig_version=5\n[application]\nconfig/name="DepChainTest"\n',
    'utf8',
  );

  // texture.png — minimal valid PNG (deepest layer, shared by all).
  fs.writeFileSync(path.join(dir, 'texture.png'), Buffer.from(fakePngBytes()));

  // material.tres — references texture.png (middle layer).
  fs.writeFileSync(
    path.join(dir, 'material.tres'),
    [
      '[gd_resource type="StandardMaterial3D" format=3]',
      '',
      '[ext_resource type="Texture2D" path="res://texture.png" id="1_tex"]',
      '',
      '[resource]',
      'albedo_texture = ExtResource("1_tex")',
      '',
    ].join('\n'),
    'utf8',
  );

  // sub.tscn — instanced sub-scene that also references texture.png.
  fs.writeFileSync(
    path.join(dir, 'sub.tscn'),
    [
      '[gd_scene load_steps=3 format=3 uid="uid://dep_chain_sub"]',
      '',
      '[ext_resource type="Texture2D" path="res://texture.png" id="1_tex"]',
      '',
      '[sub_resource type="StandardMaterial3D" id="mat"]',
      'albedo_texture = ExtResource("1_tex")',
      '',
      '[node name="SubRoot" type="MeshInstance3D"]',
      '',
    ].join('\n'),
    'utf8',
  );

  // main.tscn — top-level scene referencing sub.tscn, material.tres, texture.png.
  fs.writeFileSync(
    path.join(dir, 'main.tscn'),
    [
      '[gd_scene load_steps=4 format=3 uid="uid://dep_chain_main"]',
      '',
      '[ext_resource type="PackedScene" uid="uid://dep_chain_sub" path="res://sub.tscn" id="1_sub"]',
      '[ext_resource type="Texture2D" path="res://texture.png" id="2_tex"]',
      '[ext_resource type="Material" path="res://material.tres" id="3_mat"]',
      '',
      '[node name="MainRoot" type="Node3D"]',
      '',
      '[node name="SubInst" type="Node3D" parent="."]',
      'instance = ExtResource("1_sub")',
      '',
    ].join('\n'),
    'utf8',
  );

  // unrelated.tscn — no references to anything in the dep chain.
  fs.writeFileSync(
    path.join(dir, 'unrelated.tscn'),
    [
      '[gd_scene format=3 uid="uid://dep_chain_unrelated"]',
      '',
      '[node name="Unrelated" type="Node3D"]',
      '',
    ].join('\n'),
    'utf8',
  );
}

/**
 * Tear down the dep-chain workspace directory. Call in `suiteTeardown`.
 */
export function teardownDepChainWorkspace(): void {
  const dir = depChainDir();
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Panel priming
// ---------------------------------------------------------------------------

/**
 * Fire `loadResource` messages through the fake panel for each resource in
 * the three-layer dependency chain, then wait for responses.
 *
 * This populates `VSCodeResourceProvider.servedResources` — the map that
 * `handleDependencyChange` consults when the watcher fires. Without this
 * priming step, the relevance gate rejects every dependency change because
 * the panel has never been asked to serve any of those files.
 *
 * The calls are sequential so each response has settled before the next
 * request goes out, keeping the served-map population deterministic.
 */
export async function primePanelForDepChain(
  triggerMessage: (msg: Record<string, unknown>) => void,
  sentMessages: HostToWebviewMessage[],
): Promise<void> {
  const resources = [
    { path: RES_SUB, resourceType: 'PackedScene', requestId: 'prime-sub' },
    { path: RES_MATERIAL, resourceType: 'Material', requestId: 'prime-mat' },
    { path: RES_TEXTURE, resourceType: 'Texture2D', requestId: 'prime-tex' },
  ];

  for (const resource of resources) {
    // Capture the response count before issuing the request so we can detect
    // the NEW response rather than returning on a previous one.
    const responseBefore = sentMessages.filter(
      (m) => m.type === 'resourceLoaded' || m.type === 'resourceLoadError',
    ).length;

    triggerMessage({ type: 'loadResource', ...resource });

    // Wait for a NEW response to appear (success or error). The served-resources
    // map is populated at path-resolution time inside VSCodeResourceProvider, so
    // even an error response means the path was recorded and the priming worked.
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const responseCount = sentMessages.filter(
        (m) => m.type === 'resourceLoaded' || m.type === 'resourceLoadError',
      ).length;
      if (responseCount > responseBefore) {
        break;
      }
      await new Promise<void>((r) => setTimeout(r, 50));
    }
    // Timeout is acceptable: path-resolution records the served entry before
    // the file-read, so even a timeout here means the served map entry exists.
  }

  // Drain any remaining async work.
  await new Promise<void>((r) => setTimeout(r, 100));
}

// ---------------------------------------------------------------------------
// Assertion utilities
// ---------------------------------------------------------------------------

/**
 * Poll `sentMessages` until a `resourceChanged` entry with the given path
 * appears, or throw if `timeoutMs` elapses.
 */
export async function waitForResourceChanged(
  sentMessages: HostToWebviewMessage[],
  expectedPath: string,
  timeoutMs = 8000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const found = sentMessages.find(
      (m) => m.type === 'resourceChanged' && (m as { path?: string }).path === expectedPath,
    );
    if (found) {
      return;
    }
    await new Promise<void>((r) => setTimeout(r, 50));
  }
  const seen = sentMessages
    .filter((m) => m.type === 'resourceChanged')
    .map((m) => (m as { path?: string }).path ?? '')
    .join(', ');
  const allTypes = sentMessages.map((m) => m.type).join(', ');
  const errors = sentMessages
    .filter((m) => m.type === 'resourceLoadError')
    .map((m) => JSON.stringify(m))
    .join('; ');
  throw new Error(
    `Timed out waiting for resourceChanged '${expectedPath}' after ${timeoutMs}ms. ` +
      `resourceChanged paths seen: [${seen || 'none'}]. ` +
      `All message types: [${allTypes || 'none'}]. ` +
      `resourceLoadError messages: [${errors || 'none'}]`,
  );
}

/**
 * Assert that no `resourceChanged` message was posted within `windowMs`.
 * Used for negative scenarios (irrelevant file changed).
 */
export async function assertNoResourceChanged(
  sentMessages: HostToWebviewMessage[],
  windowMs = 500,
): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, windowMs));
  const found = sentMessages.some((m) => m.type === 'resourceChanged');
  if (found) {
    throw new Error(
      'Expected no resourceChanged message, but at least one was posted.',
    );
  }
}

/**
 * Return the current count of `resourceChanged` messages in `sentMessages`.
 * Snapshot this before an action and compare after to detect new messages.
 */
export function countResourceChanged(sentMessages: HostToWebviewMessage[]): number {
  return sentMessages.filter((m) => m.type === 'resourceChanged').length;
}

/** Return all `resourceChanged` res:// paths posted so far. */
export function resourceChangedPaths(sentMessages: HostToWebviewMessage[]): string[] {
  return sentMessages
    .filter((m) => m.type === 'resourceChanged')
    .map((m) => (m as { path?: string }).path ?? '');
}
