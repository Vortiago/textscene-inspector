/** ConfirmationDialog registers the AcceptDialog parse plus the Cancel text. Property knowledge for the linter lives in linterParser.ts. */
import { registerWindowParser } from '../window/registerWindowType';
import { parseConfirmationDialog } from './parser';

registerWindowParser('ConfirmationDialog', parseConfirmationDialog);
