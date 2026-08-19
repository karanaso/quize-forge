#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# QuizForge: migrate a running Docker Compose deployment to Podman (rootful).
#
# Run as root on the Debian/Ubuntu server, from any directory. The script
# locates the repo via its own path and derives the Docker volume mountpoint
# with `docker volume inspect`, so it is safe to run from anywhere.
#
# It performs (in order):
#   1. Backup  - tar of the Docker volume AND a mongodump (two copies)
#   2. Copy    - Docker volume -> Podman volume (only if the Podman volume is empty)
#   3. Build   - the app image with `podman build`
#   4. Cutover - stop Docker Compose (volume untouched), start Quadlet units
#   5. Verify  - the app responds on :3000
#
# On failure after the cutover starts, it rolls back to Docker Compose.
# Before the cutover, Docker Compose is never stopped, so you can re-run.
# ---------------------------------------------------------------------------
set -euo pipefail

# --- config (override via env) ----------------------------------------------
PODMAN_VOLUME="${PODMAN_VOLUME:-quizforge-mongodb}"
PODMAN_NETWORK="${PODMAN_NETWORK:-quizforge-net}"
BACKUP_DIR="${BACKUP_DIR:-/root/quizforge-migrate-backup}"
APP_IMAGE="${APP_IMAGE:-quizforge:local}"
APP_ENV_FILE="${APP_ENV_FILE:-/etc/quizforge/app.env}"
DOCKER_VOLUME="${DOCKER_VOLUME:-}"

# --- paths -------------------------------------------------------------------
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SYSTEMD_DIR="/etc/containers/systemd"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

log() { printf '\033[1;32m[quizforge]\033[0m %s\n' "$*"; }
err() { printf '\033[1;31m[quizforge]\033[0m %s\n' "$*" >&2; }

# --- preflight ---------------------------------------------------------------
[ "$(id -u)" -eq 0 ] || { err "run this script as root."; exit 1; }
command -v podman >/dev/null 2>&1 || { err "podman is not installed (apt install podman podman-compose)."; exit 1; }
command -v docker >/dev/null 2>&1 || { err "docker is not installed."; exit 1; }
[ -f "$REPO_DIR/docker-compose.yml" ] || { err "docker-compose.yml not found at $REPO_DIR."; exit 1; }

if [ -z "$DOCKER_VOLUME" ]; then
  DOCKER_VOLUME="$(docker volume ls -q | grep -i 'mongodb-data' | head -1 || true)"
  if [ -z "$DOCKER_VOLUME" ]; then
    err "could not find the Docker mongo volume automatically; set DOCKER_VOLUME=<name>."
    exit 1
  fi
  log "detected Docker volume: $DOCKER_VOLUME"
fi
DOCKER_DATA="$(docker volume inspect "$DOCKER_VOLUME" --format '{{.Mountpoint}}')"
[ -d "$DOCKER_DATA" ] || { err "Docker volume mountpoint not found: $DOCKER_DATA"; exit 1; }

mkdir -p "$BACKUP_DIR" "$SYSTEMD_DIR"

CUTOVER_STARTED=0

rollback() {
  if [ "$CUTOVER_STARTED" -eq 1 ]; then
    log "rolling back to Docker Compose..."
    systemctl disable --now app.service mongo.service 2>/dev/null || true
    podman rm -f quizforge-app quizforge-mongo 2>/dev/null || true
    docker compose -f "$REPO_DIR/docker-compose.yml" up -d
    log "rollback finished. Verify the app and retry the migration later."
  else
    err "failed before the cutover — Docker Compose was never stopped. Re-run after fixing the error."
  fi
}
trap rollback ERR

# --- 1. backup ---------------------------------------------------------------
log "backing up the Docker volume (tar)..."
docker run --rm -v "${DOCKER_VOLUME}:/data:ro" -v "${BACKUP_DIR}:/backup" alpine \
  tar czf "/backup/${DOCKER_VOLUME}-${TIMESTAMP}.tgz" -C /data .

MONGO_CONTAINER="$(docker compose -f "$REPO_DIR/docker-compose.yml" ps -q mongodb 2>/dev/null | head -1 || true)"
if [ -n "$MONGO_CONTAINER" ]; then
  log "backing up with mongodump (instance archive)..."
  docker exec "$MONGO_CONTAINER" mongodump --archive --gzip \
    > "${BACKUP_DIR}/quizforge-mongodump-${TIMESTAMP}.archive"
else
  err "mongo container not running via compose — skipped mongodump. The tar backup is still in place."
fi
log "backups written to $BACKUP_DIR"

# --- 2. podman network + volume + data copy ----------------------------------
log "creating podman network and volume..."
podman network create "$PODMAN_NETWORK" 2>/dev/null || true
podman volume create "$PODMAN_VOLUME" 2>/dev/null || true

PODMAN_DATA="$(podman volume inspect "$PODMAN_VOLUME" --format '{{.Mountpoint}}')"
if [ "$(find "$PODMAN_DATA" -mindepth 1 2>/dev/null | wc -l)" -eq 0 ]; then
  log "copying data from $DOCKER_DATA into the podman volume..."
  podman run --rm -v "${DOCKER_DATA}:/src:ro" -v "${PODMAN_VOLUME}:/dst" alpine \
    sh -c 'cp -a /src/. /dst/'
  log "copied $(find "$PODMAN_DATA" -type f | wc -l) files"
else
  log "podman volume is not empty — skipping the copy (re-run with a fresh volume to migrate again)."
fi

# --- 3. build the image ------------------------------------------------------
log "building app image $APP_IMAGE ..."
cd "$REPO_DIR"
podman build -t "$APP_IMAGE" .

# --- 4. deploy env + units ---------------------------------------------------
mkdir -p "$(dirname "$APP_ENV_FILE")"
if [ ! -f "$APP_ENV_FILE" ]; then
  cp "$REPO_DIR/deploy/podman/app.env.example" "$APP_ENV_FILE"
  log "created $APP_ENV_FILE — EDIT IT with your real credentials before continuing."
  err "aborting: edit $APP_ENV_FILE, then re-run this script."
  exit 1
fi
cp "$REPO_DIR"/deploy/podman/*.container "$SYSTEMD_DIR/"
systemctl daemon-reload

# --- 5. cutover --------------------------------------------------------------
log "stopping Docker Compose (the Docker volume stays intact)..."
docker compose -f "$REPO_DIR/docker-compose.yml" down --timeout 30 || true
CUTOVER_STARTED=1

log "starting Podman services..."
systemctl enable --now mongo.service app.service
sleep 5

# --- 6. verify ---------------------------------------------------------------
if curl -sf -o /dev/null http://localhost:3000/login; then
  log "app responds on http://localhost:3000/login — migration complete."
  log "You can now remove Docker later once you are confident."
  log "Keep the backups in $BACKUP_DIR until then."
else
  err "app did not respond on :3000. Check: journalctl -u app.service -e"
  exit 1
fi
