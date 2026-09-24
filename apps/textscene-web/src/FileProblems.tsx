/**
 * The Source pane's file-level section: the findings that name no line, which no gutter row
 * can hold. It sits in the pane header with a dot for their highest severity, their count and
 * a hover or focus popover, as a gutter row has. Unlike a gutter dot it takes keyboard focus,
 * since nothing else reaches these findings.
 */
import { useId, useState } from 'react';
import type { DiagnosticGroup } from './lineDiagnostics';
import { problemPopoverClass, severityDotClass } from './problemClasses';
import styles from './r3f-main.module.css';

export interface FileProblemsProps {
  /**
   * The findings with no line. The caller mounts this only while there is one, so a new set
   * opens closed.
   */
  group: DiagnosticGroup;
}

export function FileProblems({ group }: FileProblemsProps) {
  const [hovered, setHovered] = useState(false);
  // Focus holds the popover open when the pointer leaves, so a long list can be scrolled.
  const [focused, setFocused] = useState(false);
  const open = hovered || focused;
  const popoverId = useId();

  function close() {
    setHovered(false);
    setFocused(false);
  }

  return (
    <>
      <button
        type="button"
        className={styles.fileProblems}
        data-testid="file-problems"
        aria-describedby={open ? popoverId : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        // Safari leaves a clicked button unfocused, so the click gives it the focus that
        // holds the popover open.
        onClick={(e) => e.currentTarget.focus()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      >
        <span className={severityDotClass(group.severity)} aria-hidden="true" />
        File-level
        <span className={styles.fileProblemsCount}>{group.messages.length}</span>
      </button>
      {open && (
        <div
          role="tooltip"
          id={popoverId}
          className={problemPopoverClass(styles.fileProblemsPopover)}
          data-testid="file-problems-popover"
        >
          {group.messages.map((message, i) => (
            <div key={i}>{message}</div>
          ))}
        </div>
      )}
    </>
  );
}
