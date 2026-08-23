#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BRANCH="${DEPLOY_BRANCH:-main}"
DEPLOY_DIR="${DEPLOY_DIR:-/home/hermes/repos/games/aladeriva}"
STATE_DIR="${STATE_DIR:-/home/hermes/.local/state/iaen-games}"
FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

mkdir -p "$STATE_DIR"
exec 9>/tmp/iaen-aladeriva-deploy.lock
if ! flock -n 9; then
  echo "INFO: ya hay una actualización de A la Deriva en curso"
  exit 0
fi

if [[ -n "$(git -C "$REPO_DIR" status --porcelain)" ]]; then
  echo "ERROR: el repositorio tiene cambios locales; no se actualiza" >&2
  exit 1
fi

echo "==> Comprobando origin/$BRANCH"
git -C "$REPO_DIR" fetch --quiet origin "$BRANCH"
LOCAL_COMMIT="$(git -C "$REPO_DIR" rev-parse HEAD)"
REMOTE_COMMIT="$(git -C "$REPO_DIR" rev-parse "refs/remotes/origin/$BRANCH")"

if [[ "$LOCAL_COMMIT" != "$REMOTE_COMMIT" ]]; then
  if ! git -C "$REPO_DIR" merge-base --is-ancestor "$LOCAL_COMMIT" "$REMOTE_COMMIT"; then
    echo "ERROR: origin/$BRANCH no es un avance directo; revisión manual necesaria" >&2
    exit 1
  fi
  git -C "$REPO_DIR" merge --ff-only "$REMOTE_COMMIT"
  LOCAL_COMMIT="$REMOTE_COMMIT"
fi

STATE_FILE="$STATE_DIR/aladeriva.commit"
DEPLOYED_COMMIT=""
[[ -f "$STATE_FILE" ]] && DEPLOYED_COMMIT="$(<"$STATE_FILE")"
if [[ "$FORCE" != "1" && "$DEPLOYED_COMMIT" == "$LOCAL_COMMIT" ]]; then
  echo "OK: sin cambios; ya está desplegado ${LOCAL_COMMIT:0:12}"
  exit 0
fi

DEPLOY_DIR="$DEPLOY_DIR" "$REPO_DIR/build.sh"
TEMP_STATE="$STATE_FILE.tmp.$$"
printf '%s\n' "$LOCAL_COMMIT" > "$TEMP_STATE"
mv -f "$TEMP_STATE" "$STATE_FILE"
echo "OK: desplegado ${LOCAL_COMMIT:0:12}"
