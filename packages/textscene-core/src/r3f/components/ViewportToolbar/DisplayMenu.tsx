/**
 * The viewport's display toggles, behind one button.
 *
 * They used to sit inline on the toolbar. At ten controls the bar wrapped to a
 * second row and spanned most of the viewport's top edge — it covered the
 * scene it exists to control, and it buried the controls legend underneath it.
 * The three things reached for constantly (3D/2D, Reset Camera, Screenshot)
 * stay on the bar; everything that is set once and forgotten lives here.
 *
 * Deliberately still inside the toolbar overlay rather than moved to the dock:
 * the capture harnesses paint the overlay out by testid and `verify:2d` clicks
 * the 2D button in it, so keeping the boundary intact keeps both working.
 */
import { useCallback, useState } from 'react';
import { useDismissable } from '../../hooks/useDismissable.js';
import styles from './ViewportToolbar.module.css';

export interface DisplayToggle {
  readonly label: string;
  readonly title: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onChange: (checked: boolean) => void;
}

export function DisplayMenu({ toggles }: { toggles: readonly DisplayToggle[] }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const rootRef = useDismissable<HTMLDivElement>(open, close);

  // Everything hidden behind the button, so the count says whether anything is
  // on without opening it — otherwise a toggle set days ago is invisible.
  const activeCount = toggles.filter((toggle) => toggle.checked && !toggle.disabled).length;

  if (toggles.length === 0) return null;

  return (
    <div className={styles.displayMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.resetButton}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        aria-expanded={open}
        aria-haspopup="true"
        title="Show or hide viewport overlays"
        data-testid="display-menu-button"
      >
        Display{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>
      {open && (
        <div
          className={styles.displayPopover}
          role="group"
          aria-label="Display options"
          data-testid="display-menu-popover"
        >
          {toggles.map((toggle) => (
            <label key={toggle.label} className={styles.checkbox} title={toggle.title}>
              <input
                type="checkbox"
                checked={toggle.checked}
                disabled={toggle.disabled}
                onChange={(e) => toggle.onChange(e.target.checked)}
              />
              {toggle.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
