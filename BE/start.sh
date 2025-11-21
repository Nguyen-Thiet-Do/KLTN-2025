#!/usr/bin/env bash
set -euo pipefail

ENV_NAME="FIREBASE_SERVICE_ACCOUNT_B64"

TARGETS=(
  "./src/config/fcmKey.json"
  "/opt/render/project/src/BE/src/config/fcmKey.json"
)

if [ -n "${!ENV_NAME:-}" ]; then
  echo "[start.sh] Found $ENV_NAME, decoding..."
  for t in "${TARGETS[@]}"; do
    dir="$(dirname "$t")"
    mkdir -p "$dir"
    echo "${!ENV_NAME}" | base64 --decode > "$t"
    chmod 600 "$t"
    echo "[start.sh] Wrote service account to $t"
  done
else
  echo "[start.sh] $ENV_NAME not found — FCM disabled."
fi

echo "[start.sh] Starting Node server..."
exec node src/server.js
