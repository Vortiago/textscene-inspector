/**
 * The linter keeps what it read from the mirror under the provider's stamp. A failed fetch must leave nothing kept,
 * or one transient failure hides a refused glTF for the rest of the session.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Linter } from '@textscene/core/linter';
import { WebResourceProvider } from './WebResourceProvider';

const TREE_GLTF = JSON.stringify({
  asset: { version: '2.0' },
  extensionsRequired: ['EXT_mesh_gpu_instancing'],
});

const USES_TREE = `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://tree.gltf" id="1_tree"]

[node name="Root" type="Node3D"]

[node name="Tree" parent="." instance=ExtResource("1_tree")]
`;

function served(body: string) {
  return {
    ok: true,
    headers: { get: (name: string) => (name === 'content-type' ? 'model/gltf+json' : null) },
    text: async () => body,
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
  };
}

/** The glTF refusals of one lint, whatever their tier. */
async function gltfRefusals(linter: Linter, provider: WebResourceProvider) {
  const diagnostics = await linter.lintComplete(USES_TREE, provider);
  return diagnostics.filter((d) => d.ruleName.startsWith('gltf-required-extension'));
}

describe('WebResourceProvider under the linter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a refused glTF whose first fetch failed once a later fetch delivers it', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const provider = new WebResourceProvider();
    const linter = new Linter();

    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await gltfRefusals(linter, provider)).toEqual([]);

    fetchMock.mockImplementation(async (url: string) =>
      url === '/fixtures/tree.gltf' ? served(TREE_GLTF) : Promise.reject(new Error('missing'))
    );
    expect(await gltfRefusals(linter, provider)).toHaveLength(1);
  });

  it('reports a refused glTF after a failed fetch of a file the renderer had already delivered', async () => {
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const provider = new WebResourceProvider();
    const linter = new Linter();
    const serveTree = async (url: string) =>
      url === '/fixtures/tree.gltf' ? served(TREE_GLTF) : Promise.reject(new Error('missing'));
    fetchMock.mockImplementation(serveTree);
    await provider.loadResource('res://tree.gltf', 'PackedScene');

    fetchMock.mockRejectedValue(new Error('offline'));
    expect(await gltfRefusals(linter, provider)).toEqual([]);

    fetchMock.mockImplementation(serveTree);
    expect(await gltfRefusals(linter, provider)).toHaveLength(1);
  });
});
