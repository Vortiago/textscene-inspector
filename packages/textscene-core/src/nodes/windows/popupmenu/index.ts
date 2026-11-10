/** PopupMenu registers the PopupMenu parse, the Window parse plus its items. Property knowledge for the linter lives in linterParser.ts. */
import { registerWindowParser } from '../window/registerWindowType';
import { parsePopupMenu } from './parser';

registerWindowParser('PopupMenu', parsePopupMenu);
