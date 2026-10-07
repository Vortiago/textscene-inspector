/** Scopes for a merge or graft test whose nodes name no resource. */
import type { InstanceScopes } from '../graftInstanceChildren';

const EMPTY = { externalResources: [], internalResources: [] };

export const NO_SCOPES: InstanceScopes = { outer: EMPTY, content: EMPTY };
