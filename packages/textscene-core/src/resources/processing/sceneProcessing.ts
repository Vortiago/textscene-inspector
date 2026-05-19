/**
 * Pure functions for scene processing.
 * Extracted from SceneLoader for use with createResourceProcessor.
 */

import type { TscnScene } from '../../parser/types';
import { TscnParser } from '../../parser/TscnParser';

// Shared parser instance (stateless, safe to reuse)
const parser = new TscnParser();

/**
 * Check if a path is a scene file (.tscn).
 */
export function isScenePath(path: string): boolean {
  return path.endsWith('.tscn');
}

/**
 * Parse TSCN content into a scene structure.
 */
export function parseSceneContent(content: string): TscnScene {
  return parser.parse(content);
}
