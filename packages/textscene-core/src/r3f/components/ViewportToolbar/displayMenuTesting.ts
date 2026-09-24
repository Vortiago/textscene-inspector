/**
 * Opens the Display menu for the toolbar's tests. The toggles are not in the
 * DOM until the menu is open, so a test opens it as a user does.
 */
import { fireEvent, screen } from '@testing-library/react';

export function openDisplayMenu(): void {
  fireEvent.click(screen.getByTestId('display-menu-button'));
}
