/** Whether the host can return an image in a tool result, which the capture tool does. */
import * as vscode from 'vscode';

/**
 * 1.105 declares `LanguageModelDataPart`, so feature detection finds it, but its host fails
 * to convert a tool result that holds one: RangeError "Array buffer allocation failed".
 */
const FIRST_MINOR_WITH_IMAGE_RESULTS = 106;

export function hostReturnsImageParts(version: string = vscode.version): boolean {
  const [major, minor] = version.split('.').map(Number);
  return major! > 1 || (major === 1 && minor! >= FIRST_MINOR_WITH_IMAGE_RESULTS);
}
