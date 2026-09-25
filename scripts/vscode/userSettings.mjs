/**
 * The settings a throwaway VS Code user-data dir is seeded with. Without them a
 * first-run window opens the Welcome tab over the editor and calls the update
 * and telemetry endpoints, which breaks an offline check and a screenshot.
 * Every harness that launches a dev host reads this one literal.
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
