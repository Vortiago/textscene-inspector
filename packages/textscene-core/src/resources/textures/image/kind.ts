/**
 * The `Image` kind: an Image resource from any origin, as the reader that builds its pixels holds
 * it. The decode keeps the text, so a read costs no pixel decode. No THREE.
 */

import type { ResourceKind } from '../../reading';

/** An Image resource: its serialised `data` Dictionary, which `decode.ts` turns into pixels. */
export interface SavedImage {
  readonly dictionary: string;
}

/** An Image from a sub-resource or its own file. Another class draws nothing. */
export const IMAGE: ResourceKind<SavedImage> = {
  name: 'Image',
  accepts: (type) => type === 'Image',
  decode: (held) => ({ dictionary: held.properties.data ?? '' }),
};
