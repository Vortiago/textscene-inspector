/**
 * The "?" link to the README's Documentation section. The VS Code webview
 * opens an http(s) link in the system browser, so one external link serves
 * both hosts.
 */
import styles from './TscnPreviewShell.module.css';

const HELP_URL =
  'https://github.com/Vortiago/textscene-inspector#documentation';

export function HelpLink() {
  return (
    <a
      className={styles.helpLink}
      href={HELP_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="Help and documentation"
      title="Help and documentation"
    >
      ?
    </a>
  );
}
