/**
 * The public entry of `@textscene/tscn`: the parser and the shapes of the scene it returns. The
 * names are listed one by one, since core is private and each name core exports through a barrel
 * would become a promise to every consumer.
 */

export { TscnParser } from '@textscene/core/parser';
export type {
  RawNode,
  TscnExternalResource,
  TscnInternalResource,
  TscnMainResource,
  TscnNode,
  TscnScene,
} from '@textscene/core/parser';
