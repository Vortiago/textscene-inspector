import styles from './TscnCanvas.module.css';

/** The class of the element a stage of the view fills: the view's own, then the host's. */
export function rootClassName(className: string | undefined): string {
  return className ? `${styles.root} ${className}` : styles.root!;
}
