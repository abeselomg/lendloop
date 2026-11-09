#!/bin/sh
# Imports the LendLoop workflows (stable ids, so re-imports overwrite rather than duplicate), publishes them
# (error handler first; n8n refuses to run an unpublished error workflow), then starts n8n via the image's own
# entrypoint. Set LENDLOOP_IMPORT_ON_BOOT=false to keep edits made in the editor across restarts.
set -e

if [ "${LENDLOOP_IMPORT_ON_BOOT:-true}" = "true" ]; then
  n8n import:workflow --separate --input=/opt/lendloop/workflows
  for id in LLErrorHandler01 LLLoanNotify0001 LLOverdueRemind1; do
    n8n publish:workflow --id="$id"
  done
fi

exec /docker-entrypoint.sh "$@"
