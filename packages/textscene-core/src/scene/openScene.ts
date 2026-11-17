/**
 * The scene a host opens: one object that owns the parse of a text and the provider its files load
 * through, before any view and with no React. Every view of the scene reads it from here.
 */

import type { ResourceProvider } from '../resources/ResourceProvider.js';
import { parseTscnContent, type ParseResult } from './parseScene.js';

/** The path a scene opens under when the host names none. */
export const DEFAULT_ROOT_SCENE_PATH = 'res://__inline__.tscn';

export interface OpenSceneOptions {
  /** The text of the `.tscn` scene. */
  source: string;
  /** How the scene's `res://` files load. */
  provider: ResourceProvider;
  /** The path the scene opens under, which its relative paths resolve from. */
  rootScenePath?: string;
}

export interface Scene {
  readonly rootScenePath: string;
  readonly provider: ResourceProvider;
  /** The parse of the current text. The same object until `setSource` gives another text. */
  parse(): ParseResult;
  /** Replaces the text, and tells each subscriber when the parse changes. */
  setSource(source: string): void;
  /** Calls `listener` after each new parse. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Lets go of every subscriber. A view of a disposed scene draws its last parse. */
  dispose(): void;
}

export function openScene({
  source,
  provider,
  rootScenePath = DEFAULT_ROOT_SCENE_PATH,
}: OpenSceneOptions): Scene {
  let currentSource = source;
  let parsed: ParseResult | null = null;
  const listeners = new Set<() => void>();
  return {
    rootScenePath,
    provider,
    parse() {
      parsed ??= parseTscnContent(currentSource, rootScenePath);
      return parsed;
    },
    setSource(next) {
      if (next === currentSource) return;
      currentSource = next;
      parsed = null;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      listeners.clear();
    },
  };
}
