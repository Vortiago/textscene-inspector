import { useMemo } from 'react';
import { parseTscnContent, type ParseResult } from '../../scene/parseScene.js';

/** Re-parses only when `content` or `rootScenePath` changes. */
export function useParsedScene(content: string, rootScenePath: string): ParseResult {
  return useMemo(() => parseTscnContent(content, rootScenePath), [content, rootScenePath]);
}
