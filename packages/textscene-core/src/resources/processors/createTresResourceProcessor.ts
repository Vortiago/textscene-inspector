/**
 * The generic `.tres` processor: a resource file's text through the FileEventBus
 * into a `ParsedResource` (header type, ext/sub resources, raw `[resource]` body)
 * on the 'resource' bus slot. It is the one parse of a file: every slice that
 * decodes Godot text reads this slot's cache.
 */

import type { FileEventBus } from '../FileEventBus';
import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { parseTresFile, type ParsedResource } from '../../parser/parsedResource';

export function createTresResourceProcessor(
  fileEventBus: FileEventBus | undefined,
  eventBus: ResourceEventBus
): ResourceProcessor<ParsedResource> {
  return createResourceProcessor({
    fileEventBus,
    eventBus,
    resourceType: 'resource',
    // Every arrival, not `.tres` alone: a request this declines stays in flight, and a
    // peer waiting on it waits out its timeout. The parse fails other text at once.
    process: async (path, data) => {
      if (typeof data !== 'string') throw new Error(`${path} is binary: only a text resource parses`);
      return parseTresFile(data);
    },
  });
}
