/**
 * Factory for the PackedScene processor — fourth peer of texture /
 * material / GLB. This previously lived in a standalone `SceneLoader`
 * class that reimplemented the same cache/inflight/event-emission
 * machine; now it shares the single `createResourceProcessor` loop with
 * the other three.
 *
 * PackedScene differs from texture/material/GLB in two ways:
 *
 *   1. It does NOT route through `FileEventBus`. Scenes are loaded via
 *      a `ResourceProvider` directly (the host's filesystem / VFS
 *      abstraction), because the parse step needs the *path*, not raw
 *      bytes — the TSCN parser consumes a string, but it also needs
 *      access to the path for relative-resource resolution. The
 *      processor below takes no `FileEventBus`; the path is fetched
 *      synchronously inside `request()`'s pre-emit hook.
 *
 *   2. Metadata-driven path resolution. Callers can request a scene by
 *      ExtResource id ("scene1") OR by raw `res://` path. The id ↔ path
 *      mapping lives in the `ResourceLoader`'s `MetadataStore` and is
 *      consulted here via the `resolvePath` callback before delegating
 *      to the provider.
 *
 * Returns a `ResourceProcessor<TscnScene>` that exposes the same
 * surface as the other three processors. `ResourceLoader.scenes` is
 * the production accessor.
 */

import type { TscnScene, TscnNode } from '../../parser/types';
import type { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { TscnParser } from '../../parser/TscnParser';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { isGLBPath } from '../processing/glbProcessing';

export interface SceneProcessorOptions {
  eventBus: ResourceEventBus;
  /**
   * Lookup function the processor calls to translate an id / path into
   * a concrete `res://` path before hitting the provider. Returns the
   * path and the originally-registered resource type so the processor
   * can reject `tex1` (a Texture2D) being requested through the scene
   * channel. Returns null when the id is unknown — the processor then
   * emits `failed` with a "metadata not found" error.
   */
  resolveMetadata: (idOrPath: string) => { path: string; type: string } | null;
  /**
   * Returns the current ResourceProvider, or null when none has been
   * set yet. Pulled lazily because the provider is wired AFTER the
   * processor is constructed (the host calls `loader.setProvider(...)`
   * during shell init).
   */
  getProvider: () => ResourceProvider | null;
}

export function createSceneProcessor({
  eventBus,
  resolveMetadata,
  getProvider,
}: SceneProcessorOptions): ResourceProcessor<TscnScene> {
  const parser = new TscnParser();

  return createResourceProcessor<TscnScene>({
    // No FileEventBus — see header note (1). The factory's direct-load
    // mode skips the bytes-then-process round-trip entirely.
    eventBus,
    resourceType: 'scene',
    loadDirectly: async (idOrPath) => {
      const metadata = resolveMetadata(idOrPath);
      if (!metadata) {
        throw new Error(`Scene metadata not found: ${idOrPath}`);
      }
      if (metadata.type !== 'PackedScene') {
        throw new Error(
          `Not a PackedScene resource: ${idOrPath} (type: ${metadata.type})`
        );
      }
      const provider = getProvider();
      if (!provider) {
        throw new Error('No ResourceProvider set');
      }
      const content = await provider.loadResource(metadata.path, metadata.type);

      // PackedScene references in Godot can point at either
      // a `.tscn` text file or a `.glb` / `.gltf` binary file (a
      // single scene can reference both kinds — e.g. props/chest.glb
      // / props/lamp.glb / props/clock.glb). The host provider
      // correctly returns text for one and ArrayBuffer for the other;
      // branch on the registered path's extension to decide how to
      // materialise the result as a TscnScene.
      if (isGLBPath(metadata.path)) {
        if (!(content instanceof ArrayBuffer)) {
          throw new Error(
            `GLB/GLTF must be binary content, got ${typeof content}: ${metadata.path}`
          );
        }
        return synthesiseGLBScene(metadata.path);
      }
      if (typeof content !== 'string') {
        throw new Error(`TSCN scene must be text content: ${metadata.path}`);
      }
      // Binary Godot resources (.scn/.res, RSRC magic) and non-TSCN text
      // (e.g. an HTML 404 fallback) would "parse" into an empty scene with
      // the lenient parser — the subtree silently vanishes with no
      // placeholder and no missing-resources row. Fail instead so the
      // standard missing-resource UX kicks in.
      if (content.startsWith('RSRC') || metadata.path.endsWith('.scn')) {
        throw new Error(
          `Binary Godot scene (.scn) is not previewable — only text scenes (.tscn) load: ${metadata.path}`
        );
      }
      if (!content.trimStart().startsWith('[gd_scene')) {
        throw new Error(`Not a text scene (missing [gd_scene header): ${metadata.path}`);
      }
      return parser.parse(content);
    },
  });
}

/**
 * Build a `TscnScene` whose only root node is a `GLBSceneRoot` —
 * the dedicated R3F component that does the actual GLB load via
 * `useResource('GLBMesh', path)` and renders the resulting THREE.Object3D.
 *
 * Why synthesise vs. parse the binary here:
 *   - GLBs aren't TSCN files; they have no externally-visible node
 *     hierarchy until the GLTFLoader runs. Doing that load at scene-
 *     processor time would block the scene's `'loaded'` event on a
 *     second async fetch (the GLB processor itself round-trips through
 *     FileEventBus), and the synthesised TscnScene then has no path to
 *     re-trigger the GLB load on a host-side `provideFile` call.
 *   - The synthesised single-node form lets the existing
 *     `NodeDispatcher` → `<GLBSceneRoot>` pipeline handle the GLB
 *     lifecycle uniformly with every other resource type. Late-arrival,
 *     dispose, and the missing-resource UX all flow through the same
 *     code paths.
 *
 * The synthesised node's name is the file basename (without extension)
 * so the SceneTreeViewer (after sub-scene inlining lands)
 * shows a meaningful label rather than a synthetic placeholder.
 */
export function synthesiseGLBScene(glbPath: string): TscnScene {
  const basename = (glbPath.split('/').pop() ?? glbPath).replace(/\.(glb|gltf)$/i, '');
  const root: TscnNode = {
    name: basename || 'GLBRoot',
    type: 'GLBSceneRoot',
    children: [],
    properties: { glbPath } as Record<string, unknown>,
  };
  return {
    nodes: [root],
    externalResources: [],
    internalResources: [],
  };
}
