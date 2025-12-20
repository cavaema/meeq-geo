#!/bin/bash
# Script per trasferire file al VPS Hetzner
# Eseguire dal Raspberry Pi

set -e

echo "📤 Trasferimento file al VPS Hetzner"
echo "====================================="

# Chiedi informazioni connessione
read -p "Indirizzo IP o dominio VPS: " VPS_HOST
read -p "Username SSH (default: root): " SSH_USER
SSH_USER=${SSH_USER:-root}

read -p "Porta SSH (default: 22): " SSH_PORT
SSH_PORT=${SSH_PORT:-22}

read -p "Directory destinazione sul VPS (default: /opt/meeq-central): " DEST_DIR
DEST_DIR=${DEST_DIR:-/opt/meeq-central}

echo ""
echo "🔄 Trasferimento file..."

# Crea directory sul VPS
ssh -p $SSH_PORT $SSH_USER@$VPS_HOST "mkdir -p $DEST_DIR/public"

# Trasferisci file
echo "  📄 central-server.js..."
scp -P $SSH_PORT central-server.js $SSH_USER@$VPS_HOST:$DEST_DIR/

echo "  📄 package.json..."
scp -P $SSH_PORT package.json $SSH_USER@$VPS_HOST:$DEST_DIR/

echo "  📄 public/central-admin.html..."
scp -P $SSH_PORT public/central-admin.html $SSH_USER@$VPS_HOST:$DEST_DIR/public/

echo "  📄 setup-central-server.sh..."
scp -P $SSH_PORT setup-central-server.sh $SSH_USER@$VPS_HOST:$DEST_DIR/

echo ""
echo "✅ File trasferiti con successo!"
echo ""
echo "📝 Prossimi passi:"
echo "   1. Connettiti al VPS: ssh $SSH_USER@$VPS_HOST"
echo "   2. Vai alla directory: cd $DEST_DIR"
echo "   3. Esegui setup: sudo bash setup-central-server.sh"
echo ""

