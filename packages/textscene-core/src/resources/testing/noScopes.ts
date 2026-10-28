/** Scopes for a merge or graft test whose nodes name no resource. */
import type { InstanceScopes } from '../graftInstanceChildren';
import type { InstanceNames } from '../instanceNameTable';
import { WAITING_FOR_SCENES } from '../sceneTrail';

const EMPTY = { externalResources: [], internalResources: [] };

export const NO_SCOPES: InstanceScopes = { outer: EMPTY, content: EMPTY };

/** An instance whose sub-scene claims no `%Name`, whose host sets none, and whose scenes are not loaded. */
export const NO_NAMES: InstanceNames = {
  own: () => new Map(),
  settings: [],
  followTrail: WAITING_FOR_SCENES,
};
