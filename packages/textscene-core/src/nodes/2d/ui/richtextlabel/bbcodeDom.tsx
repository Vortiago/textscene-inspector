/**
 * Minimal Godot BBCode → React renderer for RichTextLabel (ADR-0003 promises a
 * best-effort [b]/[i]/[color]/… subset rather than full BBCode). Supported tags
 * map to inline CSS; unknown tags are dropped but their inner text is kept.
 * Nesting is handled by merging the open-tag style stack onto each text run.
 *
 * Tokenizing (tag stack/nesting) lives in `bbcode.ts`, shared with the native
 * painter; this file's own job is turning that stack into CSS. Named
 * `bbcodeDom` rather than `bbcode` (its pre-split name) because a bare
 * `./bbcode` specifier and `moduleResolution: Bundler` cannot disambiguate a
 * `.ts`/`.tsx` pair sharing a basename — `.ts` always wins, silently, for
 * every importer — and `allowImportingTsExtensions: false` rules out fixing
 * that by writing the extension explicitly.
 */

import type { CSSProperties, ReactNode } from 'react';
import { colorToCss } from '../../../../r3f/controls/styleBoxToCss';
import { type OpenBBCodeTag, parseBBCodeRuns } from './bbcode';

/** Tag name → CSS contribution. `[color=...]` carries a value. */
const TAG_STYLE: Record<string, (value?: string) => CSSProperties> = {
  b: () => ({ fontWeight: 'bold' }),
  i: () => ({ fontStyle: 'italic' }),
  u: () => ({ textDecoration: 'underline' }),
  s: () => ({ textDecoration: 'line-through' }),
  code: () => ({ fontFamily: 'var(--tsi-font-mono, monospace)' }),
  center: () => ({ display: 'block', textAlign: 'center' }),
  color: (value) => (value ? { color: bbColor(value) } : {}),
};

/** BBCode colors are either a Godot `Color(...)`, a `#hex`, or a CSS name. */
function bbColor(value: string): string {
  return value.startsWith('Color(') ? (colorToCss(value) ?? value) : value;
}

function styleForTags(tags: readonly OpenBBCodeTag[]): CSSProperties {
  return Object.assign({}, ...tags.map((t) => (TAG_STYLE[t.name] ? TAG_STYLE[t.name]!(t.value) : {})));
}

/**
 * Parse a BBCode subset into React nodes. Each text run is wrapped in a single
 * `<span>` carrying the merged style of all currently-open supported tags
 * (plain string when no styling applies).
 */
export function parseBBCode(text: string): ReactNode[] {
  return parseBBCodeRuns(text).map((run, key) => {
    const style = styleForTags(run.tags);
    return Object.keys(style).length ? (
      <span key={key} style={style}>
        {run.text}
      </span>
    ) : (
      run.text
    );
  });
}
