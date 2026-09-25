/**
 * The generic `.tres` processor: a resource file's text through the FileEventBus
 * into a `ParsedResource` (header type, ext/sub resources, raw `[resource]` body)
 * on the 'resource' bus slot, for consumers such as the TileSet resolver. It shares
 * .tres paths with the material processor, since each handles only its own flights.
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
    shouldProcess: (path, data) => path.endsWith('.tres') && typeof data === 'string',
    process: async (_path, data) => parseTresFile(data as string),
  });
}
