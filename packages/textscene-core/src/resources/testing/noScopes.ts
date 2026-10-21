/** Scopes for a merge or graft test whose nodes name no resource. */
import type { InstanceScopes } from '../graftInstanceChildren';
import type { InstanceNames } from '../instanceNameTable';

const EMPTY = { externalResources: [], internalResources: [] };

export const NO_SCOPES: InstanceScopes = { outer: EMPTY, content: EMPTY };

/** An instance whose sub-scene claims no `%Name` and whose host sets none. */
export const NO_NAMES: InstanceNames = { own: () => undefined, settings: [] };
