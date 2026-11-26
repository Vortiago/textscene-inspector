import { TscnParser } from '../parser/TscnParser.js';
import { tscnSceneToParsedScene, buildSceneGraph } from '../core/SceneGraph.js';
import type { SceneGraph } from '../core/SceneGraph.js';
import type { TscnScene } from '../parser/types.js';
import { isGltfPath } from '../godot/import/gltf.js';
import { synthesiseGLBScene } from '../resources/processors/createSceneProcessor.js';

export interface ParseResult {
  sceneGraph: SceneGraph | null;
  error: string | null;
}

export function parseTscnContent(content: string, rootScenePath: string): ParseResult {
  // A .glb/.gltf is not TSCN text, so one GLBSceneRoot stands in and fetches the bytes itself.
  if (isGltfPath(rootScenePath)) {
    return toParseResult(rootScenePath, synthesiseGLBScene(rootScenePath));
  }
  if (!content) {
    return { sceneGraph: null, error: null };
  }
  try {
    const parser = new TscnParser();
    const tscnScene = parser.parse(content);

    // Text the lenient parser salvages to zero nodes is a broken file, not "No nodes to display".
    if (tscnScene.nodes.length === 0 && content.trim().length > 0) {
      return {
        sceneGraph: null,
        error: 'Parser could not extract any nodes from the content. The file may be malformed.',
      };
    }

    return toParseResult(rootScenePath, tscnScene);
  } catch (err) {
    return {
      sceneGraph: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function toParseResult(rootScenePath: string, tscnScene: TscnScene): ParseResult {
  const parsedScene = tscnSceneToParsedScene(rootScenePath, tscnScene);
  return { sceneGraph: buildSceneGraph(parsedScene), error: null };
}
