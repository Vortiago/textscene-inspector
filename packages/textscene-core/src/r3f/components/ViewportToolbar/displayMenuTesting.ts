/**
 * Opening the Display menu, for the toolbar's test files.
 *
 * The display toggles are not in the DOM until the menu is open (see
 * `DisplayMenu.tsx` for why they moved there), so a test that wants one has to
 * open it exactly as a user would. Shared so the three suites that need it do
 * not each carry their own copy of that fact.
 */
import { fireEvent, screen } from '@testing-library/react';

export function openDisplayMenu(): void {
  fireEvent.click(screen.getByTestId('display-menu-button'));
}
