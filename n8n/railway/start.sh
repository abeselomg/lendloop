#!/bin/sh
# Imports the LendLoop workflows (stable ids, so re-imports overwrite rather than duplicate), publishes them
# (error handler first; n8n refuses to run an unpublished error workflow), then starts n8n via the image's own
# entrypoint. Set LENDLOOP_IMPORT_ON_BOOT=false to keep edits made in the editor across restarts.
set -e

if [ "${LENDLOOP_IMPORT_ON_BOOT:-true}" = "true" ]; then
  # The "Resend API" credential (id referenced by the workflows) must exist even in mock mode: n8n 2.x redacts the
  # data of every run of a workflow whose credential is missing, hiding the mock notifications in Executions.
  # The file is private to this process and removed straight after the import.
  creds=$(mktemp)
  chmod 600 "$creds"
  printf '[{"id":"LLResendApiKey01","name":"Resend API","type":"httpHeaderAuth","data":{"name":"Authorization","value":"Bearer %s"}}]'     "${RESEND_API_KEY:-not-configured}" > "$creds"
  n8n import:credentials --input="$creds" || echo "WARNING: Resend credential import failed; runs stay redacted in Executions"
  rm -f "$creds"

  n8n import:workflow --separate --input=/opt/lendloop/workflows
  for id in LLErrorHandler01 LLLoanNotify0001 LLOverdueRemind1; do
    n8n publish:workflow --id="$id"
  done
fi

exec /docker-entrypoint.sh "$@"
