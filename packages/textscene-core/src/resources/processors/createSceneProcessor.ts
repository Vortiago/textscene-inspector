/**
 * The PackedScene processor on the shared `createResourceProcessor` loop, exposed
 * as `ResourceLoader.scenes`. It is the PackedScene slice's loader-facing adapter
 * (`resources/formats/packedscene/`, ADR-0031), kept here because it loads without
 * `FileEventBus` and resolves ids through metadata.
 */

import type { TscnScene, TscnNode } from '../../parser/types';
import type { ResourceEventBus } from '../ResourceEventBus';
import type { ResourceProvider } from '../ResourceProvider';
import { TscnParser } from '../../parser/TscnParser';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { isGLBPath } from '../formats/glb/glbProcessing';

/**
 * The `[gd_scene]` tag after any leading `;` comment and blank lines, which Godot
 * and the top-level parser both allow, so a scene that renders at top level also
 * loads when instanced. Anything else up front (HTML 404, stray text) fails.
 */
const SCENE_HEADER = /^(?:[ \t]*(?:;[^\n]*)?\r?\n)*[ \t]*\[gd_scene/;

export interface SceneProcessorOptions {
  eventBus: ResourceEventBus;
  /**
   * An ExtResource id ("scene1") or `res://` path to a path and its registered type
   * from the `ResourceLoader`'s `MetadataStore`, so a Texture2D fails here. Null for
   * an unknown id. A falsy `type` means none was declared (an undeclared path, or no
   * `type=`), so the content checks decide.
   */
  resolveMetadata: (idOrPath: string) => { path: string; type: string | null } | null;
  /**
   * Returns the current ResourceProvider, or null when none has been
   * set yet. Pulled lazily because the provider is wired after the
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
    // No FileEventBus: the parser needs the path for relative-resource resolution,
    // so the host's `ResourceProvider` loads the scene directly inside `request()`'s
    // pre-emit hook, skipping the bytes-then-process round-trip.
    eventBus,
    resourceType: 'scene',
    loadDirectly: async (idOrPath) => {
      const metadata = resolveMetadata(idOrPath);
      if (!metadata) {
        throw new Error(`Scene metadata not found: ${idOrPath}`);
      }
      if (metadata.type && metadata.type !== 'PackedScene') {
        throw new Error(
          `Not a PackedScene resource: ${idOrPath} (type: ${metadata.type})`
        );
      }
      const provider = getProvider();
      if (!provider) {
        throw new Error('No ResourceProvider set');
      }
      // A HINT about what to fetch, not the claim the guard settled: the
      // channel it was asked through is what it is being asked for.
      const content = await provider.loadResource(metadata.path, metadata.type || 'PackedScene');

      // A PackedScene can be a `.tscn` text file or a `.glb` / `.gltf` binary, and
      // one scene can reference both. The provider returns text or an ArrayBuffer,
      // so the registered path's extension decides how to make a TscnScene.
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
      // The lenient parser would "parse" a binary resource (.scn/.res, RSRC magic)
      // or non-TSCN text (an HTML 404) into an empty scene whose subtree vanishes
      // with no placeholder or missing-resources row, so it fails instead.
      if (content.startsWith('RSRC') || metadata.path.endsWith('.scn')) {
        throw new Error(
          `Binary Godot scene (.scn) is not previewable — only text scenes (.tscn) load: ${metadata.path}`
        );
      }
      if (!SCENE_HEADER.test(content)) {
        throw new Error(`Not a text scene (missing [gd_scene header): ${metadata.path}`);
      }
      return parser.parse(content);
    },
  });
}

/**
 * A `TscnScene` whose only root is a `GLBSceneRoot`, which loads the GLB through
 * `useResource('GLBMesh', path)`. Loading it here would block `'loaded'` on a
 * second fetch with no way to re-trigger on `provideFile`, and the dispatcher gives
 * the GLB the same late-arrival, dispose and missing-resource paths as the rest.
 */
export function synthesiseGLBScene(glbPath: string): TscnScene {
  // The file basename, so the scene tree shows a meaningful label.
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
