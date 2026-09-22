/**
 * The settings a throwaway VS Code user-data-dir is seeded with.
 *
 * A first-run window otherwise opens the Welcome tab over the editor and starts
 * talking to the update and telemetry endpoints — which pollutes an offline
 * check and puts the wrong thing in a screenshot. Every harness that launches a
 * dev-host reads this one literal, so a new welcome/telemetry knob is added
 * once rather than found missing in whichever harness was not updated.
 */
export const THROWAWAY_USER_SETTINGS = Object.freeze({
  'workbench.startupEditor': 'none',
  'workbench.tips.enabled': false,
  'workbench.enableExperiments': false,
  'update.mode': 'none',
  'update.showReleaseNotes': false,
  'extensions.autoUpdate': false,
  'extensions.autoCheckUpdates': false,
  'telemetry.telemetryLevel': 'off',
  'window.restoreWindows': 'none',
  'window.newWindowDimensions': 'default',
  'editor.minimap.enabled': false,
});
