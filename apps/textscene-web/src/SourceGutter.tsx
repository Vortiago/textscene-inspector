/**
 * The source pane's linter gutter: a row per line, a dot for the highest severity
 * on the line (`lineDiagnostics.ts`), and a hover or focus popover of its messages.
 * The `scrollTop` prop keeps it in step with the textarea.
 */
import { memo, useMemo, useRef, useState } from 'react';
import type { DiagnosticGroup } from './lineDiagnostics';
import { placeGutterPopover, type PopoverPlacement } from './gutterPopover';
import { severityDotClass } from './problemClasses';
import styles from './r3f-main.module.css';

export interface SourceGutterProps {
  /** Total number of lines in the buffer (at least 1, even for an empty buffer). */
  lineCount: number;
  byLine: ReadonlyMap<number, DiagnosticGroup>;
  /** The textarea's current `scrollTop`, so the gutter's rows track it. */
  scrollTop: number;
}

/** The open popover's line, and where it opens: `null` where there was no layout to measure. */
interface OpenPopover {
  line: number;
  placement: PopoverPlacement | null;
}

interface GutterPopoverProps {
  line: number;
  messages: readonly string[];
  placement: PopoverPlacement | null;
}

/** A row's messages, beside it: upward and capped as `placement` says, else the CSS default. */
function GutterPopover({ line, messages, placement }: GutterPopoverProps) {
  const direction = placement?.opensUp ? styles.gutterPopoverUp : '';
  return (
    <div className={`${styles.gutterPopover} ${direction}`}>
      <div
        role="tooltip"
        className={`${styles.problemPopover} ${styles.gutterPopoverBody}`}
        data-testid={`gutter-popover-${line}`}
        style={placement ? { maxHeight: placement.maxHeight } : undefined}
      >
        {messages.map((message, i) => (
          <div key={i}>{message}</div>
        ))}
      </div>
    </div>
  );
}

/**
 * `React.memo`'d: `byLine` is already memoised upstream (`groupDiagnostics`)
 * and `lineCount` is a stable number, so without this the gutter would rebuild
 * its full N-row list on every unrelated `R3FApp` render (every keystroke,
 * every scroll) even when none of its own props changed.
 */
export const SourceGutter = memo(function SourceGutter({
  lineCount,
  byLine,
  scrollTop,
}: SourceGutterProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<OpenPopover | null>(null);
  // A lint that drops the open row's finding renders that row without its handlers, so no leave
  // event would ever close it, and the popover would come back with the next finding there.
  if (open && !byLine.has(open.line)) setOpen(null);
  const lines = useMemo(
    () => Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1),
    [lineCount]
  );

  /** Opens `line`'s popover, placed against the gutter's visible height as it is now. */
  function show(line: number, row: HTMLElement) {
    const gutter = gutterRef.current?.getBoundingClientRect();
    const box = row.getBoundingClientRect();
    const top = gutter?.top ?? 0;
    const placement = placeGutterPopover({
      rowTop: box.top - top,
      rowBottom: box.bottom - top,
      viewportHeight: gutter?.height ?? 0,
    });
    setOpen({ line, placement });
  }

  function hide(line: number) {
    setOpen((current) => (current?.line === line ? null : current));
  }

  return (
    <div ref={gutterRef} className={styles.gutter} data-testid="source-gutter" aria-hidden="true">
      <div className={styles.gutterInner} style={{ transform: `translateY(${-scrollTop}px)` }}>
        {lines.map((line) => {
          const entry = byLine.get(line);
          if (!entry) return <div key={line} className={styles.gutterRow} />;
          const isOpen = open?.line === line;
          // The row, not the dot, holds the hover: the popover is its child, so the pointer
          // can move onto the list and scroll it without leaving.
          return (
            <div
              key={line}
              className={styles.gutterRow}
              data-testid={`gutter-row-${line}`}
              onMouseEnter={(e) => show(line, e.currentTarget)}
              onMouseLeave={() => hide(line)}
              onFocus={(e) => show(line, e.currentTarget)}
              onBlur={() => hide(line)}
            >
              <button
                type="button"
                tabIndex={-1}
                className={severityDotClass(entry.severity)}
                data-testid={`gutter-dot-${line}`}
                aria-label={`Line ${line}: ${entry.messages.join('; ')}`}
              />
              {isOpen && (
                <GutterPopover line={line} messages={entry.messages} placement={open.placement} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
