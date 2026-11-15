/** Whether each file loads in Godot, on the 'loadoutcome' bus slot. */

import type { ResourceEventBus } from '../ResourceEventBus';
import { createResourceProcessor, type ResourceProcessor } from '../createResourceProcessor';
import { loadOutcome, type LoadFacts, type LoadOutcome } from '../loadFailure/loadOutcome';

/** `factsFor(path)` reads what the walk from `path` needs, each read recorded against `path`. */
export function createLoadOutcomeProcessor(
  eventBus: ResourceEventBus,
  factsFor: (path: string) => LoadFacts
): ResourceProcessor<LoadOutcome> {
  return createResourceProcessor({
    eventBus,
    resourceType: 'loadoutcome',
    loadDirectly: (path) => loadOutcome(path, factsFor(path)),
  });
}
