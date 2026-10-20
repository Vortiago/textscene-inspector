/** Scopes for a merge or graft test whose nodes name no resource. */
import type { ClaimedPath, InstanceScopes } from '../graftInstanceChildren';

const EMPTY = { externalResources: [], internalResources: [] };

export const NO_SCOPES: InstanceScopes = { outer: EMPTY, content: EMPTY };

/** A sub-scene whose own `%Name` table claims nothing. */
export const NO_CLAIMS: ClaimedPath = () => undefined;
