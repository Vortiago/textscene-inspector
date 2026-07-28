/**
 * The viewport's display toggles, behind one button.
 *
 * The seven of them used to sit inline on the toolbar, which at ten controls
 * wrapped to a second row spanning most of the viewport's top edge — covering
 * the scene it exists to control, and burying the controls legend underneath
 * it. The three things reached for constantly (3D/2D, Reset Camera, Screenshot)
 * stay on the bar; everything set once and forgotten lives here.
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

  if (toggles.length === 0) return null;

  // Everything is hidden behind the button, so the count says whether anything
  // is on without opening it — otherwise a toggle set days ago is invisible.
  // Disabled ones do not count: a preview that yielded to the scene's own light
  // reads as checked, and counting it would claim the user turned it on.
  const activeCount = toggles.filter((toggle) => toggle.checked && !toggle.disabled).length;

  return (
    <div className={styles.displayMenu} ref={rootRef}>
      <button
        type="button"
        className={styles.displayButton}
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
                data-testid={`display-toggle-${toggle.label}`}
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
