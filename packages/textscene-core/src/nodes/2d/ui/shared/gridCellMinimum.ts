/** The grid column rule `GridContainer` and the ColorPicker's slider grid share. */

/**
 * A child's extent as a grid column or row keeps it: `GridContainer` stores its minimums as `int`
 * (`grid_container.cpp:290-291`), so a fractional child minimum loses its fraction.
 */
export function gridCellMinimumExtent(childMinimum: number): number {
  return Math.trunc(childMinimum);
}
