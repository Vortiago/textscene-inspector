/**
 * Help affordance — a small "?" link in the shared top bar pointing
 * at the GitHub-hosted README's Documentation section, which in turn links
 * `docs/user-guide-web.md` / `docs/user-guide-vscode.md`. A single external
 * link keeps the web app and the VS Code webview at parity: VS Code's
 * webview host intercepts http(s) anchor clicks and opens them in the
 * system browser, so no host-specific wiring is needed here.
 */
import styles from './TscnPreviewShell.module.css';

const HELP_URL =
  'https://github.com/Vortiago/Text-Scene-.tscn-File-Previewer#documentation';

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
