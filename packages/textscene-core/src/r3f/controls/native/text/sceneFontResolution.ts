/**
 * Pure walk of a `FontResource` graph (`../../../../resources/processing/fontProcessing.ts`
 * — read-only from here, this module never edits that pipeline) down to the
 * one thing this engine's runtime font loader needs: real font bytes.
 *
 * Godot's three Font resource kinds recurse into each other (a `.tres`
 * wrapper's own `fallbacks`, a `FontVariation`'s `base_font`) before real
 * bytes are ever reached — `fontProcessing.ts`'s own doc has the full shape.
 * This walk mirrors that recursion exactly once, so `sceneFontLoader.ts`
 * (the DOM-touching orchestrator) and its tests never need to re-derive
 * "which face actually renders" from the raw resource tree themselves.
 *
 * `SystemFont` (`kind: 'system'`) always fails to resolve here — its
 * `font_names` are OS family names this previewer has no access to load
 * bytes for (`fontProcessing.ts`'s own doc). A `SystemFont` behind a
 * `fallbacks` list is skipped in favour of the next entry that DOES resolve,
 * exactly like a `FontFile` fallback with no bytes of its own is.
 */
import type { FontFileResource, FontResource } from '../../../../resources/processing/fontProcessing';

export interface ResolvedFontBytes {
  /** Raw font bytes, ready for `new FontFace(name, bytes)`. */
  readonly bytes: ArrayBuffer;
  /** The specific `FontFileResource` these bytes came from — a stable object identity `sceneFontLoader.ts` keys its load-cache on (the same resource object is reused across nodes/renders that reference the same underlying font, per this codebase's resource-loader caching). */
  readonly leaf: FontFileResource;
}

/**
 * Depth-first walk: `FontVariation` -> `baseFont`, `FontFile` -> its own
 * `bytes` if present else the first `fallbacks` entry that resolves,
 * `SystemFont` -> never resolves. Returns `null` for `undefined`/`null` (no
 * font authored at this node — the theme's own default) and for any branch
 * that bottoms out with no loadable bytes.
 */
export function resolveFontFileBytes(font: FontResource | null | undefined): ResolvedFontBytes | null {
  if (!font) return null;

  switch (font.kind) {
    case 'system':
      return null;

    case 'variation':
      return resolveFontFileBytes(font.baseFont);

    case 'file': {
      if (font.bytes) {
        return { bytes: font.bytes, leaf: font };
      }
      for (const fallback of font.fallbacks) {
        const resolved = resolveFontFileBytes(fallback);
        if (resolved) return resolved;
      }
      return null;
    }
  }
}
