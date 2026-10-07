/**
 * The generic `.tres` processor: a resource file's text through the FileEventBus
 * into a `ParsedResource` (header type, ext/sub resources, raw `[resource]` body)
 * on the 'resource' bus slot. It parses whole files only, so a consumer of a
 * **Sub-resource path** loads the owning file and reads the sub-resource itself.
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
