/** FileDialog registers the ConfirmationDialog parse plus the mode, access, filters, options and customisation flags. Property knowledge for the linter lives in linterParser.ts. */
import { registerWindowParser } from '../window/registerWindowType';
import { parseFileDialog } from './parser';

registerWindowParser('FileDialog', parseFileDialog);
