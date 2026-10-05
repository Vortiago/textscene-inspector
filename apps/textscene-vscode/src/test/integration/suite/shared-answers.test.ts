/**
 * The shared language-feature and agent-tool answers on the development build, on every
 * operating system CI runs. The installed-package suite checks the same answers on the
 * packaged .vsix, and the `tscn-lsp` end-to-end test checks them over JSON-RPC.
 */

import { godotProjectDir } from '../helpers/godotProjectHelpers';
import { defineAgentToolAnswersSuite } from '../../languageFeatures/agentToolAnswersSuite.testkit';
import { defineSharedAnswersSuite } from '../../languageFeatures/sharedAnswersSuite.testkit';

defineSharedAnswersSuite(godotProjectDir('shared-answers'));
defineAgentToolAnswersSuite(godotProjectDir('shared-agent-tools'));
