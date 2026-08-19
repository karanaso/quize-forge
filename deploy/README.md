# Deploying QuizForge with Podman

This directory contains everything needed to run QuizForge on a
self-managed Linux server with **rootful Podman + Quadlet** (systemd-managed
containers). It is a migration path from an existing Docker Compose
deployment and preserves your MongoDB data.

The local `docker-compose.yml` and `Dockerfile` remain the canonical build
sources — Podman reads the same OCI-compatible image.

## Layout

| File | Purpose |
| --- | --- |
| `deploy/podman/mongo.container` | Quadlet unit for MongoDB (internal network, no published port) |
| `deploy/podman/app.container` | Quadlet unit for the app (publishes `3000:3000`, depends on mongo) |
| `deploy/podman/app.env.example` | Template for `/etc/quizforge/app.env` |
| `deploy/migrate-docker-to-podman.sh` | One-shot migration: backup → copy data → build → cutover → verify |

## One-shot migration (from Docker Compose)

```bash
# 0. On the server, as root:
apt update && apt install -y podman podman-compose

# 1. Copy the repo to the server (or git pull there), then run:
sudo bash deploy/migrate-docker-to-podman.sh
```

The script:

1. **Backs up twice** — a `tar` of the Docker volume and a `mongodump`
   archive — into `/root/quizforge-migrate-backup`.
2. Creates the `quizforge-net` network and `quizforge-mongodb` volume, then
   copies the data from the Docker volume into it.
3. Builds `quizforge:local` from the `Dockerfile`.
4. Copies the `.container` files to `/etc/containers/systemd/` and writes
   `/etc/quizforge/app.env` (edit the credentials; the script aborts until
   you do).
5. Stops Docker Compose (volume untouched) and starts the Quadlet services.
6. Verifies the app answers on `http://localhost:3000/login`.

On any failure after the cutover begins, it rolls back to Docker Compose
automatically. Before the cutover, Docker is never stopped, so re-running
is safe.

### Manual steps (what the script does)

```bash
# install podman
apt install -y podman podman-compose

# create network + volume
podman network create quizforge-net
podman volume create quizforge-mongodb

# copy the Docker volume data into the podman volume
DOCKER_DATA=$(docker volume inspect quiz-forge_mongodb-data --format '{{.Mountpoint}}')
podman run --rm -v "$DOCKER_DATA:/src:ro" -v quizforge-mongodb:/dst alpine \
  sh -c 'cp -a /src/. /dst/'

# build the image from the repo root
podman build -t quizforge:local .

# install the units + env file
mkdir -p /etc/containers/systemd /etc/quizforge
cp deploy/podman/mongo.container deploy/podman/app.container /etc/containers/systemd/
cp deploy/podman/app.env.example /etc/quizforge/app.env   # then edit it
systemctl daemon-reload

# stop docker, start podman
docker compose down
systemctl enable --now mongo.service app.service
```

## Environment file

`/etc/quizforge/app.env` is a plain `KEY=VALUE` file (no shell expansion):

```
MONGODB_URI=mongodb://quizforge-mongo:27017/quizforge
TEACHER_USERNAME=teacher
TEACHER_PASSWORD=…
SESSION_SECRET=…
APP_URL=http://localhost:3000
```

- `quizforge-mongo` is the container name on the `quizforge-net` network —
  Podman's built-in DNS resolves it.
- Generate `SESSION_SECRET` with `openssl rand -base64 32`.
- The app keeps listening on port `3000`, so your **reverse proxy (nginx /
  Caddy / Traefik) configuration does not change**.

## Operations

```bash
systemctl status mongo.service app.service   # status
journalctl -u app.service -e                 # app logs
podman logs quizforge-app                    # or per-container logs
systemctl restart app.service                # restart the app
systemctl restart mongo.service              # restart mongo (rare)
```

Both units `Restart=always` and are enabled on boot.

## Rollback to Docker (before you remove Docker)

```bash
systemctl disable --now app.service mongo.service
podman rm -f quizforge-app quizforge-mongo
docker compose up -d      # data is still in the Docker volume
```

## Cleaning up Docker (later, once confident)

```bash
# only when you no longer need the Docker stack:
docker compose -f docker-compose.yml down -v   # -v removes the Docker volume + data
apt remove --purge docker-ce docker-compose-plugin   # or your distro's equivalent
```

Keep the backups under `/root/quizforge-migrate-backup` until the new stack
has been running for a while.

## Going rootless later

Rootful Podman works today; if you want the stronger rootless posture later,
create a dedicated system user, rebuild the units with `User=` and a
rootless `PublishPort`, and use `podman` in rootless socket-activated mode.
The `Dockerfile` and app code need no changes.
