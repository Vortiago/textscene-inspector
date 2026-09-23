/**
 * The controls legend: a summary pill, and a panel with the binding table for
 * every input device. Godot's editor bindings leave a plain left-drag inert,
 * so the viewport says what to press. `<ViewportArea>` mounts it in both
 * modes, and the rows come from `bindings.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDismissable } from '../../hooks/useDismissable.js';
import { useGlobalShortcut } from '../../hooks/useGlobalShortcut.js';
import { controlsFor } from './bindings.js';
import styles from './ViewportControlsHelp.module.css';

export interface ViewportControlsHelpProps {
  mode: '2D' | '3D';
}

export function ViewportControlsHelp({ mode }: ViewportControlsHelpProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useDismissable<HTMLDivElement>(open, close);
  const { summary, groups } = controlsFor(mode);

  // `role="dialog"` promises focus inside it. Focus returns to the pill on close.
  const panelRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (wasOpenRef.current) hintRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  const toggle = useCallback(() => setOpen((wasOpen) => !wasOpen), []);
  // Not F1: `useGlobalShortcut` never calls preventDefault, and in a VS Code
  // webview F1 opens the command palette.
  useGlobalShortcut('?', toggle);

  return (
    <div className={styles.root} ref={rootRef} data-testid="viewport-controls-help">
      <button
        type="button"
        className={styles.hint}
        ref={hintRef}
        onClick={toggle}
        aria-expanded={open}
        title="Show every viewport control (?)"
        data-testid="viewport-controls-hint"
      >
        <span className={styles.summary}>{summary}</span>
        <span className={styles.badge} aria-hidden>
          ?
        </span>
      </button>

      {open && (
        <div
          className={styles.panel}
          ref={panelRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-label={`${mode} viewport controls`}
          data-testid="viewport-controls-panel"
        >
          <div className={styles.panelHead}>
            <h2 className={styles.panelTitle}>{mode} viewport controls</h2>
            <button
              type="button"
              className={styles.close}
              onClick={close}
              aria-label="Close viewport controls"
            >
              ✕
            </button>
          </div>
          <div className={styles.groups}>
            {groups.map((group) => (
              <section key={group.device} className={styles.group}>
                <h3 className={styles.device}>{group.device}</h3>
                <dl className={styles.bindings}>
                  {group.bindings.map((binding) => (
                    <div key={binding.input} className={styles.binding}>
                      <dt className={styles.input}>{binding.input}</dt>
                      <dd className={styles.action}>{binding.action}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
