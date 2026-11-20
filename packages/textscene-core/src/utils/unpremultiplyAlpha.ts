const OPAQUE = 255;

/**
 * RGBA8 bytes with premultiplied colour turned to straight alpha, in place. A clear pixel keeps its bytes.
 *
 * @canonical Turns premultiplied RGBA8 bytes into straight alpha
 */
export function unpremultiplyAlpha(data: Uint8Array): void {
  for (let at = 0; at < data.length; at += 4) {
    const alpha = data[at + 3]!;
    if (alpha === 0 || alpha === OPAQUE) continue;
    for (let channel = at; channel < at + 3; channel++) {
      data[channel] = Math.min(OPAQUE, Math.round((data[channel]! * OPAQUE) / alpha));
    }
  }
}
