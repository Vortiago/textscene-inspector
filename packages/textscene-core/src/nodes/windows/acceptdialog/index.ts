/** AcceptDialog registers the dialog parse, the Window parse plus the dialog text. Property knowledge for the linter lives in linterParser.ts. */
import { registerWindowParser } from '../window/registerWindowType';
import { parseDialog } from './parser';

registerWindowParser('AcceptDialog', parseDialog);
