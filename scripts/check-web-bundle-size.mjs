#!/usr/bin/env node

import { checkWebFirstPaint } from './check-bundle-size/webFirstPaint.mjs';

// Every failure is an error: the web previewer's build job runs this right after it builds.
if (checkWebFirstPaint() !== 'ok') process.exit(1);
