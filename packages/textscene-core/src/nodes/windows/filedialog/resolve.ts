/**
 * A FileDialog once a host has listed the folders it names: where the `DirAccess` stands, which rows the file list holds
 * and what they leave in the File field and the OK button. `fileDialogFolders` says which folders to ask for and
 * `resolveFileDialog` settles the dialog from the answers. The parse alone is the dialog with every folder taken as existing
 * and an empty list, which is what a host that cannot list gives.
 */

import type { TscnNode } from '../../../parser/types';
import { listingKey, type DirectoryListings } from '../../../resources/directoryListing';
import { RES_SCHEME } from '../../../resources/resPath';
import { settleFileList } from './fileList';
import type { FileDialogLocation } from './location';
import { replayLocation, type FileDialogProperties } from './parser';

/** The placing lines replayed against `listings`, and the `res://` folders the replay asked about, in the order it asked. */
function place(node: TscnNode, listings: DirectoryListings) {
  const asked: string[] = [];
  const exists = (folder: string): boolean => {
    if (!folder.startsWith(RES_SCHEME)) return true;
    const key = listingKey(folder);
    if (!asked.includes(key)) asked.push(key);
    return listings[key]?.kind !== 'missing';
  };
  const location: FileDialogLocation = replayLocation(node.rawProperties, node.name, exists);
  return { location, asked };
}

const isResFolder = (folder: string | null): folder is string => folder?.startsWith(RES_SCHEME) === true;

/** The `res://` folders to ask a host for: each one a line names, then the one the list shows. */
export function fileDialogFolders(node: TscnNode, listings: DirectoryListings): string[] {
  const { location, asked } = place(node, listings);
  const shown = isResFolder(location.listed_dir) ? listingKey(location.listed_dir) : null;
  return shown === null || asked.includes(shown) ? asked : [...asked, shown];
}

/** The dialog node with the location, the file list, the File field and the OK button `listings` settle. */
export function resolveFileDialog(node: TscnNode, listings: DirectoryListings): TscnNode {
  const props = node.properties as FileDialogProperties;
  const { location } = place(node, listings);
  const answer = isResFolder(location.listed_dir) ? listings[listingKey(location.listed_dir)] : null;
  const settled = settleFileList({
    entries: answer?.kind === 'listed' ? answer.entries : [],
    filters: props.filters,
    showHiddenFiles: props.show_hidden_files,
    fileMode: props.file_mode,
    currentFile: location.current_file,
    isOkDisabled: props.ok_button_disabled ?? false,
    okText: props.ok_button_text,
    hasCustomOkText: props.has_custom_ok_text,
  });
  const resolved: FileDialogProperties = {
    ...props,
    ...location,
    // A File field the list rewrote is a new text, so its selection goes.
    file_selection: settled.currentFile === location.current_file ? location.file_selection : null,
    file_rows: settled.rows,
    selected_row: settled.selectedRow,
    current_file: settled.currentFile,
    ok_button_disabled: settled.isOkDisabled,
    ok_button_text: settled.okText,
  };
  return { ...node, properties: resolved };
}
