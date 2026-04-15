#!/usr/bin/env bash
set -euo pipefail

APP_NAME="darttournament"
APP_DIR="/opt/${APP_NAME}"
WEB_ROOT="/var/www/${APP_NAME}/current"
NGINX_SITE="/etc/nginx/sites-available/${APP_NAME}"
SYSTEMD_SERVICE="/etc/systemd/system/${APP_NAME}.service"
REPO_URL="https://github.com/ROosterloo1988/zomercompetitie"
DOMAIN=""
EMAIL=""
BRANCH="main"
MODE="static" # static | fastapi

# Prefer current repo remote if script is run from a git checkout.
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  CURRENT_REMOTE="$(git config --get remote.origin.url || true)"
  if [[ -n "${CURRENT_REMOTE}" ]]; then
    REPO_URL="${CURRENT_REMOTE}"
  fi
fi

usage() {
  cat <<USAGE
Usage: sudo ./scripts/install_ubuntu.sh [options]

Options:
  --repo <url>        Git repo URL to deploy (default: ${REPO_URL})
  --branch <name>     Git branch to deploy (default: ${BRANCH})
  --domain <domain>   Optional domain for nginx/certbot TLS
  --email <email>     Email for Let's Encrypt (required with --domain)
  --mode <type>       Deploy mode: static or fastapi (default: ${MODE})
  --help              Show this help

Examples:
  sudo ./scripts/install_ubuntu.sh
  sudo ./scripts/install_ubuntu.sh --mode fastapi
  sudo ./scripts/install_ubuntu.sh --repo https://github.com/your/repo --branch main
  sudo ./scripts/install_ubuntu.sh --domain darts.example.com --email admin@example.com
USAGE
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_URL="$2"
      shift 2
      ;;
    --branch)
      BRANCH="$2"
      shift 2
      ;;
    --domain)
      DOMAIN="$2"
      shift 2
      ;;
    --email)
      EMAIL="$2"
      shift 2
      ;;
    --help)
      usage
      exit 0
      ;;
    --mode)
      MODE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if [[ "${MODE}" != "static" && "${MODE}" != "fastapi" ]]; then
  echo "--mode must be 'static' or 'fastapi'"
  exit 1
fi

if [[ -n "${DOMAIN}" && -z "${EMAIL}" ]]; then
  echo "--email is required when --domain is provided"
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run as root (sudo)."
  exit 1
fi

echo "==> Installing system packages"
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  git \
  rsync \
  nginx \
  ca-certificates \
  curl \
  python3 \
  python3-venv \
  python3-pip \
  ufw \
  certbot \
  python3-certbot-nginx

echo "==> Cloning/updating repository"
mkdir -p "${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone --branch "${BRANCH}" "${REPO_URL}" "${APP_DIR}"
else
  git -C "${APP_DIR}" fetch --all --prune
  git -C "${APP_DIR}" checkout "${BRANCH}"
  git -C "${APP_DIR}" pull --ff-only
fi

if [[ "${MODE}" == "static" ]]; then
  echo "==> Deploying static files"
  mkdir -p "${WEB_ROOT}"
  rsync -av --delete \
    --exclude '.git' \
    --exclude 'node_modules' \
    --exclude '.github' \
    "${APP_DIR}/" "${WEB_ROOT}/"

  chown -R www-data:www-data "/var/www/${APP_NAME}"

  echo "==> Writing nginx site (static mode)"
  cat > "${NGINX_SITE}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN:-_};

    root ${WEB_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location = /sw.js {
        add_header Cache-Control "no-cache";
    }

    location = /manifest.webmanifest {
        add_header Cache-Control "no-cache";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|svg|ico)$ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
NGINX
else
  echo "==> Setting up FastAPI virtualenv"
  if [[ ! -f "${APP_DIR}/server/main.py" ]]; then
    echo "FastAPI mode requested but ${APP_DIR}/server/main.py was not found."
    echo "Tip: use --repo with the Tournament Manager repository."
    exit 1
  fi

  python3 -m venv "${APP_DIR}/.venv"
  "${APP_DIR}/.venv/bin/pip" install --upgrade pip
  "${APP_DIR}/.venv/bin/pip" install fastapi uvicorn jinja2 python-multipart itsdangerous

  echo "==> Writing systemd service for FastAPI"
  cat > "${SYSTEMD_SERVICE}" <<SERVICE
[Unit]
Description=${APP_NAME} FastAPI service
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}
ExecStart=${APP_DIR}/.venv/bin/uvicorn server.main:app --host 127.0.0.1 --port 9000
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
SERVICE

  systemctl daemon-reload
  systemctl enable "${APP_NAME}"
  systemctl restart "${APP_NAME}"
  sleep 2
  if ! systemctl is-active --quiet "${APP_NAME}"; then
    echo "FastAPI service failed to start. Last logs:"
    journalctl -u "${APP_NAME}" -n 40 --no-pager || true
    exit 1
  fi

  echo "==> Writing nginx site (fastapi mode)"
  cat > "${NGINX_SITE}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN:-_};

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
NGINX
fi

ln -sf "${NGINX_SITE}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx
if [[ "${MODE}" == "fastapi" ]]; then
  sleep 1
  if ! curl -fsS "http://127.0.0.1:9000/" >/dev/null; then
    echo "Warning: FastAPI upstream on 127.0.0.1:9000 is not healthy."
    echo "Check: systemctl status ${APP_NAME} && journalctl -u ${APP_NAME} -n 100 --no-pager"
    exit 1
  fi
fi

echo "==> Opening firewall for web"
ufw allow 'Nginx Full' || true

if [[ -n "${DOMAIN}" ]]; then
  echo "==> Requesting Let's Encrypt certificate for ${DOMAIN}"
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect
fi

echo "\n✅ Install complete"
echo "App path: ${APP_DIR}"
echo "Mode: ${MODE}"
if [[ "${MODE}" == "static" ]]; then
  echo "Web root: ${WEB_ROOT}"
else
  echo "FastAPI upstream: http://127.0.0.1:9000"
fi
if [[ -n "${DOMAIN}" ]]; then
  echo "URL: https://${DOMAIN}"
else
  echo "URL: http://<server-ip>/"
fi

echo "\nTo update later:"
echo "  sudo ${APP_DIR}/scripts/install_ubuntu.sh --mode ${MODE} --repo ${REPO_URL} --branch ${BRANCH}${DOMAIN:+ --domain ${DOMAIN} --email ${EMAIL}}"
