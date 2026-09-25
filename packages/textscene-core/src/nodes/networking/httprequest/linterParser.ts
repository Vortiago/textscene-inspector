/**
 * HTTPRequest strict validators: only its own members, the ones doc/classes/HTTPRequest.xml lists
 * without `overrides=`. The NODE_BASE_TYPES base walk delivers everything from Node up, so a
 * re-declared inherited key shadows it and duplicates the rule. HTTPRequest declares no
 * `get_configuration_warnings()` override (http_request.cpp/.h).
 */

import '../../node/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { v } from '../../../linter/validators/index.js';

validatorRegistry.registerAll('HTTPRequest', {
  // http_request.cpp:672, BOOL, no hint. set_accept_gzip (:549-551) is a bare assignment.
  accept_gzip: v.boolean('accept_gzip'),
  // http_request.cpp:673, PROPERTY_HINT_RANGE "-1,2000000000,suffix:B" (both ends closed).
  // set_body_size_limit (:557-561) checks only connection state, then assigns, so the hint is the
  // only authority. -1 is the documented "no limit" sentinel, not a floor to reject.
  body_size_limit: v.int('body_size_limit', { min: -1, max: 2000000000, hinted: 'http_request.cpp:673' }),
  // http_request.cpp:670, PROPERTY_HINT_RANGE "256,16777216,suffix:B". set_download_chunk_size
  // (:577-581) forwards to HTTPClientTCP::set_read_chunk_size (http_client_tcp.cpp:761-764), whose
  // ERR_FAIL_COND(p_size < 256 || p_size > (1 << 24)) enforces the same bounds, so both ends error.
  download_chunk_size: v.int('download_chunk_size', {
    min: 256,
    max: 16777216,
    enforced: 'http_client_tcp.cpp:762',
    hinted: 'http_request.cpp:670',
  }),
  // http_request.cpp:669, STRING, PROPERTY_HINT_FILE_PATH: a file-browser
  // hint, not a PROPERTY_HINT_RANGE, so nothing bounds the value. set_download_file
  // (:567-571) only ERR_FAIL_CONDs on connection state. Godot writes it as a
  // quoted TSCN string literal.
  download_file: v.quotedString('download_file'),
  // http_request.cpp:674, PROPERTY_HINT_RANGE "-1,64" (both ends closed).
  // set_max_redirects (:591-593) is a bare assignment. -1 is the documented
  // "no limit" sentinel per get_body_size's note on chunked/unknown lengths.
  max_redirects: v.int('max_redirects', { min: -1, max: 64, hinted: 'http_request.cpp:674' }),
  // http_request.cpp:675, PROPERTY_HINT_RANGE "0,3600,0.1,or_greater,suffix:s"
  // (or_greater opens the ceiling, so no max here). set_timeout (:615-618)
  // ERR_FAIL_COND(p_timeout < 0), matching the hint's floor exactly, so the
  // floor is an error rather than a warning.
  timeout: v.float('timeout', { min: 0, enforced: 'http_request.cpp:616', hinted: 'http_request.cpp:675' }),
  // http_request.cpp:671, BOOL, no hint. set_use_threads (:538-543) only
  // ERR_FAIL_CONDs on connection state (and no-ops without THREADS_ENABLED);
  // the boolean value itself is never rejected.
  use_threads: v.boolean('use_threads'),
});
