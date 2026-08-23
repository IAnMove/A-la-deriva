#!/usr/bin/env bash
set -Eeuo pipefail

REPO_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_DIR="${DEPLOY_DIR:-/home/hermes/repos/games/aladeriva}"
RUN_TESTS="${RUN_TESTS:-1}"
DRY_RUN="${DRY_RUN:-0}"

case "$DEPLOY_DIR" in
  /home/hermes/repos/games/aladeriva|/var/www/games/aladeriva) ;;
  *)
    echo "ERROR: destino no autorizado: $DEPLOY_DIR" >&2
    exit 2
    ;;
esac

for command_name in rsync jq npm find; do
  command -v "$command_name" >/dev/null || {
    echo "ERROR: falta el comando $command_name" >&2
    exit 1
  }
done

[[ -s "$REPO_DIR/index.html" ]] || { echo "ERROR: falta index.html" >&2; exit 1; }
[[ -s "$REPO_DIR/project.json" ]] || { echo "ERROR: falta project.json" >&2; exit 1; }
jq empty "$REPO_DIR/project.json"

if [[ "$RUN_TESTS" == "1" ]]; then
  echo "==> Ejecutando pruebas"
  (cd "$REPO_DIR" && npm test)
fi

STAGE_DIR="$(mktemp -d /tmp/aladeriva-build.XXXXXX)"
trap 'rm -rf -- "$STAGE_DIR"' EXIT
chmod 755 "$STAGE_DIR"
mkdir -p "$STAGE_DIR/contenido" "$STAGE_DIR/contenido/assets" "$STAGE_DIR/contenido/vendor"

echo "==> Preparando publicación"
mapfile -d '' GAME_JS < <(find "$REPO_DIR" -maxdepth 1 -type f -name '*.js' ! -name 'playwright.config.js' -print0)
[[ "${#GAME_JS[@]}" -gt 0 ]] || { echo "ERROR: no se encontraron módulos del juego" >&2; exit 1; }
rsync -a "$REPO_DIR/index.html" "$REPO_DIR/style.css" "${GAME_JS[@]}" "$STAGE_DIR/contenido/"
rsync -a --exclude='characters/preview/' "$REPO_DIR/assets/" "$STAGE_DIR/contenido/assets/"
rsync -a --include='*.js' --exclude='*' "$REPO_DIR/vendor/" "$STAGE_DIR/contenido/vendor/"
rsync -a "$REPO_DIR/project.json" "$STAGE_DIR/"
if [[ -d "$REPO_DIR/screenshots" ]]; then
  rsync -a "$REPO_DIR/screenshots/" "$STAGE_DIR/screenshots/"
fi

[[ -s "$STAGE_DIR/contenido/index.html" ]] || { echo "ERROR: publicación sin index.html" >&2; exit 1; }
jq empty "$STAGE_DIR/project.json"
if find "$STAGE_DIR" \( -name .git -o -name node_modules -o -name tests -o -name playwright.config.js \) -print | grep -q .; then
  echo "ERROR: la publicación contiene archivos privados o de desarrollo" >&2
  exit 1
fi

mkdir -p "$DEPLOY_DIR"
RSYNC_ARGS=(-a --delete --delete-delay --delay-updates)
if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run --itemize-changes)
  echo "==> Simulación de despliegue en $DEPLOY_DIR"
else
  echo "==> Desplegando en $DEPLOY_DIR"
fi
rsync "${RSYNC_ARGS[@]}" "$STAGE_DIR/" "$DEPLOY_DIR/"

if [[ "$DRY_RUN" != "1" ]]; then
  [[ -s "$DEPLOY_DIR/contenido/index.html" ]] || { echo "ERROR: despliegue incompleto" >&2; exit 1; }
  echo "OK: A la Deriva desplegado"
fi
