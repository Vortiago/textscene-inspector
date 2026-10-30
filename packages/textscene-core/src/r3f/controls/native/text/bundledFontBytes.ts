/**
 * The bundled Open Sans SemiBold as WOFF2 bytes, decoded from base64 once. The canvas font
 * registration and the outline reader both read them, and only a chunk that needs a font imports this.
 */
import { decodeBase64Bytes } from '../../../../godot/variant/packedBytes';
import { OPEN_SANS_WOFF2_BASE64 } from './openSansFontBytes';

/** Written only by `bundledFontBytes`, once. */
let decoded: ArrayBuffer | undefined;

export function bundledFontBytes(): ArrayBuffer {
  decoded ??= decodeBase64Bytes(OPEN_SANS_WOFF2_BASE64).buffer;
  return decoded;
}
