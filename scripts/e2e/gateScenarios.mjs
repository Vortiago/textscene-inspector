import {
  checkEyeAndHover,
  EYE_AND_HOVER_FIXTURE,
  measureEyeAndHover,
  runEyeAndHoverScenario,
} from './eyeAndHoverScenario.mjs';
import { checkViewStatus, runViewStatusScenario, VIEW_STATUS_FIXTURE } from './viewStatusScenario.mjs';
import { checkViewKeys, measureViewKeys, runViewKeysScenario } from './viewKeysScenario.mjs';
import { checkFrameFit, measureFrameFit, runFrameFitScenario } from './frameFitScenario.mjs';
import { checkZoomButtons, measureZoomButtons, runZoomButtonsScenario } from './zoomButtonsScenario.mjs';
import { inkStats } from '../vscode/pixels.mjs';
import { shardOf } from '../shards/shards.mjs';
import { longTasksAfterFirstReply, longTasksDuringTextureWork } from './textureWorkProbe.mjs';
import {
  checkBlockedControl,
  checkStalledControl,
  checkWorkerArm,
  checkSettleControl,
  DELAY_FIXTURE,
  LARGE_FIXTURE,
  LARGE_TRES_FIXTURE,
  runLongTaskArms,
  runSettleControl,
} from './textureWorkScenarios.mjs';
import { checkDiagnostics } from './diagnostics.mjs';
import { checkPhoneLayout, runPhoneScenario } from './phoneScenario.mjs';
import { checkUploadScenarios, runUploadScenarios } from './uploadScenarios.mjs';
import {
  CAMERA_PREVIEW_FIXTURE,
  checkCameraPreview,
  runCameraPreviewScenario,
} from './cameraPreviewScenario.mjs';
import { checkInGame, IN_GAME_FIXTURE, runInGameScenario } from './inGameScenario.mjs';
import { checkInGameStretch, runInGameStretchScenario, STRETCH_FIXTURE } from './inGameStretchScenario.mjs';
import { checkCameraButtons, runCameraButtonsScenario } from './cameraButtonsScenario.mjs';
import { checkInGameToolbar, runInGameToolbarScenario } from './inGameToolbarScenario.mjs';
import { checkModeSwitch, runModeSwitchScenario } from './modeSwitchScenario.mjs';
import { checkWorkspace, runWorkspaceScenario, WORKSPACE_FIXTURE } from './workspaceScenario.mjs';
import {
  CAMERA_FRAME_2D_FIXTURE,
  checkCameraFrame2D,
  runCameraFrame2DScenario,
} from './cameraFrame2DScenario.mjs';
import {
  checkEditorHelpers,
  measureEditorHelpers,
  runEditorHelpersScenario,
} from './editorHelpersScenario.mjs';
import {
  check2D,
  check3D,
  EXPECTED_3D_PATHS,
  FIXTURE_2D,
  FIXTURE_3D,
  measure2D,
  measure3D,
  run2DScenario,
  run3DScenario,
  SELECT_A,
} from './editorViewScenarios.mjs';
import {
  checkInstanceClick,
  INSTANCE_CLICK_FIXTURE,
  measureInstanceClick,
  runInstanceClickScenario,
} from './instanceClickScenario.mjs';

// The 4096x4096 noise field, drawn at 1/8 scale, fills a 512x512 square: most of it is ink.
const INK_FLOOR_LARGE_TEXTURE = 20000;

/** The Long Tasks API reports only tasks over 50 ms, so 0 means it saw none in the window. */
const longest = (tasks) => Math.max(0, ...(tasks ?? []).map((task) => task.duration));

function checkLongTasks(gate, { withWorker, fromTres, blocked, stalled }) {
  const largeTexture = { inkOf: inkStats, inkFloor: INK_FLOOR_LARGE_TEXTURE };
  // The status clears only after the banded upload, so a cleared status and a reply prove off-thread work.
  checkWorkerArm(gate, 'long tasks', withWorker, largeTexture);
  checkWorkerArm(gate, 'long tasks, .tres material', fromTres, largeTexture);
  checkBlockedControl(gate, blocked);
  checkStalledControl(gate, stalled);
  checkDiagnostics(gate, '[long tasks]', withWorker.diagnostics);
  checkDiagnostics(gate, '[long tasks, .tres material]', fromTres.diagnostics);
}

const measureLongTasks = ({ withWorker, fromTres, blocked, stalled }) =>
  `long tasks in the texture window  worker after the reply: replies=${withWorker.probe.replies} ` +
  `longest=${longest(longTasksAfterFirstReply(withWorker.probe, 0))}ms | ` +
  `.tres material after the reply: replies=${fromTres.probe.replies} ` +
  `longest=${longest(longTasksAfterFirstReply(fromTres.probe, 0))}ms | ` +
  `blocked: longest=${longest(longTasksDuringTextureWork(blocked.probe, 0))}ms | ` +
  `stalled after the reply: longest=${longest(longTasksAfterFirstReply(stalled.probe, 0))}ms`;

/** In run order. CI splits them into shards of equal `seconds`, each one's time on a CI runner. */
export const SCENARIOS = [
  {
    name: '3D',
    title: `3D scenario: ${FIXTURE_3D}`,
    seconds: 29,
    run: run3DScenario,
    check: check3D,
    measure: measure3D,
  },
  {
    name: 'instance click',
    title: `instance click: ${INSTANCE_CLICK_FIXTURE}`,
    seconds: 5,
    run: runInstanceClickScenario,
    check: checkInstanceClick,
    measure: measureInstanceClick,
  },
  {
    name: 'eye and hover',
    title: `tree eye and row hover: ${EYE_AND_HOVER_FIXTURE}`,
    seconds: 6,
    run: runEyeAndHoverScenario,
    check: checkEyeAndHover,
    measure: measureEyeAndHover,
  },
  {
    name: 'view keys',
    title: `view keys: F, O and Shift+F in the 3D and 2D views`,
    seconds: 10,
    run: runViewKeysScenario,
    check: checkViewKeys,
    measure: measureViewKeys,
  },
  {
    name: 'frame fit',
    title: 'frame fit: F in a tall orthographic view, and frame on open',
    seconds: 9,
    run: runFrameFitScenario,
    check: checkFrameFit,
    measure: measureFrameFit,
  },
  {
    name: 'zoom buttons',
    title: `zoom buttons: clicks on the 2D zoom HUD reach both ends of the range`,
    seconds: 8,
    run: runZoomButtonsScenario,
    check: checkZoomButtons,
    measure: measureZoomButtons,
  },
  {
    name: 'workspace',
    title: `workspace by the root's class: ${WORKSPACE_FIXTURE} and its .glb`,
    seconds: 8,
    run: runWorkspaceScenario,
    check: checkWorkspace,
  },
  {
    name: 'camera frame 2D',
    title: `Cameras panel frame of a Camera2D: ${CAMERA_FRAME_2D_FIXTURE}`,
    seconds: 6,
    run: runCameraFrame2DScenario,
    check: checkCameraFrame2D,
  },
  {
    name: 'view status',
    title: `view status notes: ${VIEW_STATUS_FIXTURE}`,
    seconds: 8,
    run: runViewStatusScenario,
    check: checkViewStatus,
  },
  {
    name: '2D',
    title: `2D scenario: ${FIXTURE_2D}`,
    seconds: 3,
    run: run2DScenario,
    check: check2D,
    measure: measure2D,
  },
  {
    name: 'texture settle',
    title: `texture settle control: ${DELAY_FIXTURE}`,
    seconds: 14,
    run: runSettleControl,
    check: checkSettleControl,
    measure: ({ baseline, delayed, unwaited }) =>
      `texture settle  baseline=${baseline.settledMs}ms delayed=${delayed.settledMs}ms ` +
      `unwaited=${unwaited.settledMs}ms workers=${delayed.workers} replies=${delayed.replies}`,
  },
  {
    name: 'long tasks',
    title: `long tasks: ${LARGE_FIXTURE} with the worker, blocked and stalled, and ${LARGE_TRES_FIXTURE}`,
    seconds: 76,
    run: (_browser, baseUrl) => runLongTaskArms(baseUrl),
    check: checkLongTasks,
    measure: measureLongTasks,
  },
  {
    name: 'phone',
    title: `phone scenario: ${FIXTURE_3D}`,
    seconds: 23,
    run: (browser, baseUrl) =>
      runPhoneScenario(browser, baseUrl, { fixture: FIXTURE_3D, selectPath: SELECT_A }),
    check: (gate, phone) =>
      checkPhoneLayout(gate, phone, { expectedPaths: EXPECTED_3D_PATHS, selectName: 'Title' }),
    measure: ({ canvasBox, dockBox, collapsedCanvasBox }) =>
      `phone  canvas=${canvasBox?.width}x${canvasBox?.height} sheet=${dockBox?.width}x${dockBox?.height} ` +
      `collapsed-canvas=${collapsedCanvasBox?.width}x${collapsedCanvasBox?.height}`,
  },
  {
    name: 'uploads',
    title: `upload scenarios: file input, drop and repeated drop over ${FIXTURE_3D}`,
    seconds: 40,
    run: (browser, baseUrl) => runUploadScenarios(browser, baseUrl, FIXTURE_3D),
    check: checkUploadScenarios,
    measure: ({ fileInput, drop, repeatedDrop }) =>
      `uploads  file-input ink=${fileInput.ink?.inkPixels} drop ink=${drop.ink?.inkPixels} ` +
      `scene-only drop ink=${repeatedDrop.sceneOnly.ink?.inkPixels} ` +
      `texture drop ink=${repeatedDrop.filled.ink?.inkPixels}`,
  },
  {
    name: 'camera preview',
    title: `camera preview: ${CAMERA_PREVIEW_FIXTURE}`,
    seconds: 36,
    run: runCameraPreviewScenario,
    check: checkCameraPreview,
  },
  {
    name: 'In-game',
    title: `In-game mode: ${IN_GAME_FIXTURE}`,
    seconds: 4,
    run: runInGameScenario,
    check: checkInGame,
    measure: ({ openedIn, isPressed, dims, ink }) =>
      `in-game  opened-in=${openedIn} pressed=${isPressed} canvas=${dims.width}x${dims.height} ink=${ink?.inkPixels}`,
  },
  {
    name: 'In-game stretch',
    title: `In-game window stretch: ${STRETCH_FIXTURE}`,
    seconds: 4,
    run: runInGameStretchScenario,
    check: checkInGameStretch,
    measure: ({ pixels }) => `in-game stretch  ${JSON.stringify(pixels)}`,
  },
  {
    name: 'camera buttons',
    title: 'camera buttons: each Cameras row in the 3D, 2D and In-game views',
    seconds: 269,
    run: runCameraButtonsScenario,
    check: checkCameraButtons,
  },
  {
    name: 'In-game toolbar',
    title: 'In-game toolbar: the notes, the disabled toggles and the selection',
    seconds: 102,
    run: runInGameToolbarScenario,
    check: checkInGameToolbar,
    measure: ({ notes, selection }) =>
      `in-game toolbar  notes=${JSON.stringify(notes.notes)} ` +
      `selection-box 3D=${selection.threeD.pixels}px In-game=${selection.inGame.pixels}px`,
  },
  {
    name: 'mode switch',
    title: 'mode switch: 3D, 2D, In-game and back',
    seconds: 43,
    run: runModeSwitchScenario,
    check: checkModeSwitch,
    measure: ({ inGamePixels, back3DPixels }) =>
      `mode switch  In-game against 3D=${inGamePixels}px 3D after the round trip=${back3DPixels}px`,
  },
  {
    name: 'editor helpers',
    title: 'editor helpers: each Display toggle on and off in the 3D view',
    seconds: 155,
    run: runEditorHelpersScenario,
    check: checkEditorHelpers,
    measure: measureEditorHelpers,
  },
];

/** The scenarios of `shard`, in run order, or every scenario for a null shard. */
export function scenariosOf(shard) {
  if (!shard) return SCENARIOS;
  const seconds = Object.fromEntries(SCENARIOS.map(({ name, seconds }) => [name, seconds]));
  return shardOf(SCENARIOS, shard, seconds);
}
