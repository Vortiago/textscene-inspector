/**
 * Helpers for the dependency-chain hot-reload tests: a Godot project in
 * `.test-workspace/dep-chain/` where main.tscn reaches texture.png through
 * sub.tscn and through material.tres, and typed paths to its files.
 */

import * as path from 'path';
import * as fs from 'fs';
import { waitFor } from './panelHelpers';
import type { HostToWebviewMessage } from '../../../protocol';

/**
 * The absolute fsPath of the dep-chain workspace. `__dirname` is the bundle's
 * output directory, four levels below the app root.
 */
export function depChainDir(): string {
  return path.resolve(__dirname, '../../../../.test-workspace/dep-chain');
}

/**
 * Absolute path to a fixture file in the dep-chain workspace, such as
 * `depChainFile('main.tscn')`.
 */
export function depChainFile(name: string): string {
  return path.join(depChainDir(), name);
}

/** Deepest layer: a texture referenced by sub.tscn, material.tres, and main.tscn. */
export const RES_TEXTURE = 'res://texture.png';
/** Middle layer: a material file referenced by main.tscn. */
export const RES_MATERIAL = 'res://material.tres';
/** First layer: an instanced sub-scene referenced by main.tscn. */
export const RES_SUB = 'res://sub.tscn';

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
 * Writes the dependency chain into `.test-workspace/dep-chain/`, recreated from
 * scratch so each run is hermetic. Call it once in `suiteSetup`. main.tscn uses
 * sub.tscn, texture.png and material.tres. sub.tscn and material.tres use
 * texture.png. unrelated.tscn shares nothing.
 */
export function setupDepChainWorkspace(): void {
  const dir = depChainDir();

  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  fs.mkdirSync(dir, { recursive: true });

  // project.godot stops findGodotProjectRoot here.
  fs.writeFileSync(
    path.join(dir, 'project.godot'),
    '; Godot Project Configuration\nconfig_version=5\n[application]\nconfig/name="DepChainTest"\n',
    'utf8',
  );

  fs.writeFileSync(path.join(dir, 'texture.png'), Buffer.from(fakePngBytes()));

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

/** Call in `suiteTeardown`. */
export function teardownDepChainWorkspace(): void {
  const dir = depChainDir();
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * Fires one `loadResource` as the webview does, so the served map that
 * `handleDependencyChange` consults holds the file, or the relevance gate drops
 * every change. Polling counts responses to catch the new one. A timeout is
 * tolerated: resolution records the entry before the read.
 */
export async function primeResource(
  triggerMessage: (msg: Record<string, unknown>) => void,
  sentMessages: HostToWebviewMessage[],
  resource: { path: string; resourceType: string; requestId: string },
): Promise<void> {
  const countResponses = () =>
    sentMessages.filter(
      (m) => m.type === 'resourceLoaded' || m.type === 'resourceLoadError',
    ).length;
  const responseBefore = countResponses();

  triggerMessage({ type: 'loadResource', ...resource });

  await waitFor(() => countResponses() > responseBefore, 5000);
  await new Promise<void>((r) => setTimeout(r, 100));
}

/**
 * Primes every resource in the chain, one at a time, so the served map fills in
 * a deterministic order.
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
    await primeResource(triggerMessage, sentMessages, resource);
  }
}

/**
 * Polls `sentMessages` for a `resourceChanged` with the given path, and throws
 * after `timeoutMs`.
 */
export async function waitForResourceChanged(
  sentMessages: HostToWebviewMessage[],
  expectedPath: string,
  timeoutMs = 8000,
): Promise<void> {
  await waitFor(
    () =>
      sentMessages.some((m) => m.type === 'resourceChanged' && m.path === expectedPath),
    timeoutMs,
    () => {
      const seen = sentMessages
        .flatMap((m) => (m.type === 'resourceChanged' ? [m.path] : []))
        .join(', ');
      const allTypes = sentMessages.map((m) => m.type).join(', ');
      const errors = sentMessages
        .filter((m) => m.type === 'resourceLoadError')
        .map((m) => JSON.stringify(m))
        .join('; ');
      return (
        `Timed out waiting for resourceChanged '${expectedPath}' after ${timeoutMs}ms. ` +
        `resourceChanged paths seen: [${seen || 'none'}]. ` +
        `All message types: [${allTypes || 'none'}]. ` +
        `resourceLoadError messages: [${errors || 'none'}]`
      );
    },
  );
}

/**
 * Runs `action` and asserts that it posts no `resourceChanged`, neither at once
 * nor within `windowMs`. The baseline count precedes the action, so a synchronous
 * post counts too.
 */
export async function assertNoResourceChanged(
  sentMessages: HostToWebviewMessage[],
  action: () => Promise<void>,
  windowMs = 500,
): Promise<void> {
  const countBefore = countResourceChanged(sentMessages);
  await action();
  await new Promise<void>((r) => setTimeout(r, windowMs));
  const countAfter = countResourceChanged(sentMessages);
  if (countAfter !== countBefore) {
    throw new Error(
      `Expected no new resourceChanged messages, got ${countAfter - countBefore}.`,
    );
  }
}

function countResourceChanged(sentMessages: HostToWebviewMessage[]): number {
  return sentMessages.filter((m) => m.type === 'resourceChanged').length;
}
