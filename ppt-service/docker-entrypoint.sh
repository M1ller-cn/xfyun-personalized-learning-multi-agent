#!/bin/sh
set -eu

output_dir="${PPT_LOCAL_STORAGE_DIR:-/app/data/outputs}"
mkdir -p "$output_dir"
chown -R appuser:appuser "$output_dir"

exec su -s /bin/sh appuser -c 'exec python -m uvicorn src.server:app --host 0.0.0.0 --port "${PORT:-8100}"'
