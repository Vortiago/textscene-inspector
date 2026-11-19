import { useGameStartFacts } from '../../gameView/gameStartFacts.js';
import styles from './TscnPreviewShell.module.css';

function scriptsNote(scriptedNodeCount: number): string {
  const holders = scriptedNodeCount === 1 ? '1 node holds' : `${scriptedNodeCount} nodes hold`;
  return `Scripts do not run: ${holders} a script.`;
}

/** What the In-game view leaves out of the game's first frame. */
export function GameStartNotes() {
  const { scriptedNodeCount, lacksCamera3D } = useGameStartFacts();
  const notes = [
    ...(scriptedNodeCount > 0 ? [scriptsNote(scriptedNodeCount)] : []),
    ...(lacksCamera3D ? ['No Camera3D is current, so the 3D world does not draw.'] : []),
  ];
  if (notes.length === 0) return null;
  return (
    <ul
      className={styles.gameStartNotes}
      role="status"
      aria-label="In-game notes"
      data-testid="game-start-notes"
    >
      {notes.map((note) => (
        <li key={note} data-testid="game-start-note">
          {note}
        </li>
      ))}
    </ul>
  );
}
