#!/bin/bash
set -e

# ============================================
# Hunter - Script de déploiement
# Chasse au Trésor Web App
# ============================================

APP_DIR="/opt/hunter"
SERVICE_NAME="hunter"
NGINX_CONF="/etc/nginx/sites-available/hunter"
NGINX_LINK="/etc/nginx/sites-enabled/hunter"
NODE_MIN_VERSION="18"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔════════════════════════════════════════╗"
echo "║   🗺️  Hunter - Chasse au Trésor        ║"
echo "║   Script de déploiement               ║"
echo "╚════════════════════════════════════════╝"
echo -e "${NC}"

# Vérifier qu'on est root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}❌ Ce script doit être exécuté en tant que root (sudo)${NC}"
    exit 1
fi

# ---- Étape 1 : Mise à jour du système ----
echo -e "${YELLOW}📦 [1/7] Mise à jour du système...${NC}"
apt-get update -qq

# ---- Étape 2 : Installation de Node.js ----
echo -e "${YELLOW}📦 [2/7] Vérification de Node.js...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
    echo -e "${GREEN}  Node.js v$(node -v) détecté${NC}"
    if [ "$NODE_VERSION" -lt "$NODE_MIN_VERSION" ]; then
        echo -e "${YELLOW}  Version trop ancienne, installation de Node.js ${NODE_MIN_VERSION}+...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
        apt-get install -y -qq nodejs
    fi
else
    echo -e "${YELLOW}  Installation de Node.js...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
fi
echo -e "${GREEN}  ✓ Node.js $(node -v) / npm $(npm -v)${NC}"

# ---- Étape 3 : Installation de nginx ----
echo -e "${YELLOW}🌐 [3/7] Vérification de nginx...${NC}"
if ! command -v nginx &> /dev/null; then
    apt-get install -y -qq nginx
fi
echo -e "${GREEN}  ✓ nginx installé${NC}"

# ---- Étape 4 : Copie des fichiers ----
echo -e "${YELLOW}📁 [4/7] Déploiement des fichiers...${NC}"

# Déterminer le répertoire source
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Créer le répertoire de l'application
mkdir -p "$APP_DIR"

# Copier les fichiers
cp -r "$SCRIPT_DIR/backend" "$APP_DIR/"
cp -r "$SCRIPT_DIR/frontend" "$APP_DIR/"

# Créer les répertoires nécessaires
mkdir -p "$APP_DIR/backend/data"
mkdir -p "$APP_DIR/backend/uploads"
mkdir -p "$APP_DIR/backend/uploads/team-photos"

# Permissions
chown -R www-data:www-data "$APP_DIR"
chmod -R 755 "$APP_DIR"
chmod -R 775 "$APP_DIR/backend/data"
chmod -R 775 "$APP_DIR/backend/uploads"

echo -e "${GREEN}  ✓ Fichiers déployés dans ${APP_DIR}${NC}"

# ---- Étape 5 : Installation des dépendances Node.js ----
echo -e "${YELLOW}📦 [5/7] Installation des dépendances...${NC}"
cd "$APP_DIR/backend"
npm install --production --silent
echo -e "${GREEN}  ✓ Dépendances installées${NC}"

# ---- Étape 6 : Configuration du service systemd ----
echo -e "${YELLOW}⚙️  [6/7] Configuration du service systemd...${NC}"

cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=Hunter - Chasse au Trésor Web App
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable ${SERVICE_NAME}
systemctl restart ${SERVICE_NAME}
echo -e "${GREEN}  ✓ Service ${SERVICE_NAME} configuré et démarré${NC}"

# ---- Étape 7 : Configuration nginx ----
echo -e "${YELLOW}🌐 [7/7] Configuration nginx...${NC}"

cp "$SCRIPT_DIR/nginx.conf" "$NGINX_CONF"

# Activer le site
if [ ! -L "$NGINX_LINK" ]; then
    ln -s "$NGINX_CONF" "$NGINX_LINK"
fi

# Désactiver le site par défaut si présent
if [ -L /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test de la config nginx
nginx -t
systemctl reload nginx
echo -e "${GREEN}  ✓ nginx configuré et rechargé${NC}"

# ---- Résumé ----
LOCAL_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}"
echo "╔════════════════════════════════════════════════╗"
echo "║   ✅ Déploiement terminé avec succès !         ║"
echo "╠════════════════════════════════════════════════╣"
echo "║                                                ║"
echo "║   🌐 Accès local :                             ║"
echo "║      http://${LOCAL_IP}                         ║"
echo "║      http://localhost                           ║"
echo "║                                                ║"
echo "║   📁 Fichiers :    ${APP_DIR}                   ║"
echo "║   ⚙️  Config :      ${APP_DIR}/backend/config/  ║"
echo "║   📊 Données :     ${APP_DIR}/backend/data/     ║"
echo "║   🖼️  Images :      ${APP_DIR}/backend/uploads/ ║"
echo "║                                                ║"
echo "║   📋 Commandes utiles :                        ║"
echo "║      sudo systemctl status hunter              ║"
echo "║      sudo systemctl restart hunter             ║"
echo "║      sudo journalctl -u hunter -f              ║"
echo "║                                                ║"
echo "╚════════════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}⚠️  N'oubliez pas de configurer le port forwarding"
echo -e "   sur votre Freebox (voir README.md)${NC}"
