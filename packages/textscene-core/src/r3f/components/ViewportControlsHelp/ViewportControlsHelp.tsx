/**
 * The viewport's controls legend: a summary pill that is always readable, and
 * a panel behind it holding the full binding table for every input device.
 *
 * It exists because the navigation swap to Godot's editor bindings made the
 * viewport unguessable — plain left-drag is deliberately inert, orbit moved to
 * the middle button, and nothing on screen said so. The pill answers "what do
 * I press" at a glance; the panel answers "what else is there".
 *
 * Both viewport modes mount it, from `<ViewportArea>`, and it reads its rows
 * from `bindings.ts`, which `bindings.test.ts` holds to the real resolvers.
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

  // `role="dialog"` promises focus lives inside it: opening from `?` otherwise
  // announces nothing and leaves Tab order wherever it was, so reaching the
  // close button means tabbing the whole page. Focus returns to the pill on
  // close, so keyboard users end up where they started.
  const panelRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLButtonElement>(null);
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (open) panelRef.current?.focus();
    else if (wasOpenRef.current) hintRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  const toggle = useCallback(() => setOpen((wasOpen) => !wasOpen), []);
  // `?` only. F1 is NOT bound: `useGlobalShortcut` deliberately never calls
  // preventDefault, and in a VS Code webview F1 is Show All Commands — the
  // palette would open over the preview every time.
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
