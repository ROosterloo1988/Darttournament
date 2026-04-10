#!/usr/bin/env bash
set -euo pipefail

APP_NAME="darttournament"
APP_DIR="/opt/${APP_NAME}"
WEB_ROOT="/var/www/${APP_NAME}/current"
NGINX_SITE="/etc/nginx/sites-available/${APP_NAME}"
REPO_URL="https://github.com/ROosterloo1988/Darttournament"
DOMAIN=""
EMAIL=""
BRANCH="main"

usage() {
  cat <<USAGE
Usage: sudo ./scripts/install_ubuntu.sh [options]

Options:
  --repo <url>        Git repo URL to deploy (default: ${REPO_URL})
  --branch <name>     Git branch to deploy (default: ${BRANCH})
  --domain <domain>   Optional domain for nginx/certbot TLS
  --email <email>     Email for Let's Encrypt (required with --domain)
  --help              Show this help

Examples:
  sudo ./scripts/install_ubuntu.sh
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
    *)
      echo "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

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

echo "==> Deploying static files"
mkdir -p "${WEB_ROOT}"
rsync -av --delete \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude '.github' \
  "${APP_DIR}/" "${WEB_ROOT}/"

chown -R www-data:www-data "/var/www/${APP_NAME}"

echo "==> Writing nginx site"
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

ln -sf "${NGINX_SITE}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl enable nginx
systemctl restart nginx

echo "==> Opening firewall for web"
ufw allow 'Nginx Full' || true

if [[ -n "${DOMAIN}" ]]; then
  echo "==> Requesting Let's Encrypt certificate for ${DOMAIN}"
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos -m "${EMAIL}" --redirect
fi

echo "\n✅ Install complete"
echo "App path: ${APP_DIR}"
echo "Web root: ${WEB_ROOT}"
if [[ -n "${DOMAIN}" ]]; then
  echo "URL: https://${DOMAIN}"
else
  echo "URL: http://<server-ip>/"
fi

echo "\nTo update later:"
echo "  sudo ${APP_DIR}/scripts/install_ubuntu.sh --repo ${REPO_URL} --branch ${BRANCH}${DOMAIN:+ --domain ${DOMAIN} --email ${EMAIL}}"
