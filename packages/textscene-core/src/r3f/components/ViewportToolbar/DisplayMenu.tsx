/**
 * The display toggles behind one button, so the toolbar stays one row. It stays
 * in the toolbar overlay, not the dock: the capture harnesses paint the overlay
 * out by testid, and `verify:2d` clicks the 2D button in it.
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

  // The count shows a toggle is on with the menu shut. A disabled one does not
  // count: a preview that yielded to the scene's light reads as checked.
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
