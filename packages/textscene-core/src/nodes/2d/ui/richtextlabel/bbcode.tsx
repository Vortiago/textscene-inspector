/**
 * Minimal Godot BBCode → React renderer for RichTextLabel (ADR-0003 promises a
 * best-effort [b]/[i]/[color]/… subset rather than full BBCode). Supported tags
 * map to inline CSS; unknown tags are dropped but their inner text is kept.
 * Nesting is handled by merging the open-tag style stack onto each text run.
 */

import type { CSSProperties, ReactNode } from 'react';
import { colorToCss } from '../../../../r3f/controls/styleBoxToCss';

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

// A tag is `[name]`, `[name=value]`, `[name attr=...]`, or a `[/name]` close.
// `value` (the `=...` form) keeps spaces so `[color=Color(1, 0, 0, 1)]` works;
// the space-attribute form is matched but its attributes are ignored.
const TOKEN = /(\[\/?[a-zA-Z][^\]]*\])/g;
const OPEN = /^\[([a-zA-Z]+)(?:=([^\]]*)|\s[^\]]*)?\]$/;
const CLOSE = /^\[\/([a-zA-Z]+)\]$/;

/**
 * Parse a BBCode subset into React nodes. Each text run is wrapped in a single
 * `<span>` carrying the merged style of all currently-open supported tags
 * (plain string when no styling applies).
 */
export function parseBBCode(text: string): ReactNode[] {
  const stack: Array<{ name: string; style: CSSProperties }> = [];
  const nodes: ReactNode[] = [];
  let key = 0;

  for (const part of text.split(TOKEN)) {
    if (!part) continue;

    const open = OPEN.exec(part);
    if (open) {
      const name = open[1]!.toLowerCase();
      const make = TAG_STYLE[name];
      stack.push({ name, style: make ? make(open[2]) : {} });
      continue;
    }

    const close = CLOSE.exec(part);
    if (close) {
      const name = close[1]!.toLowerCase();
      for (let i = stack.length - 1; i >= 0; i--) {
        if (stack[i]!.name === name) {
          stack.splice(i, 1);
          break;
        }
      }
      continue;
    }

    // Plain text run.
    const style = Object.assign({}, ...stack.map((s) => s.style)) as CSSProperties;
    nodes.push(
      Object.keys(style).length ? (
        <span key={key++} style={style}>
          {part}
        </span>
      ) : (
        part
      )
    );
  }

  return nodes;
}
