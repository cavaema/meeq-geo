#!/bin/bash
# Script per creare app.html sul VPS
# Esegui questo script SUL VPS (non sul Raspberry Pi)
# Copia e incolla questo script sul VPS e eseguilo

set -e

VPS_DIR="/opt/meeq-central"
OUTPUT_FILE="$VPS_DIR/public/app.html"

echo "📝 Creazione app.html sul VPS..."
echo "=================================="

# Verifica che la directory esista
if [ ! -d "$VPS_DIR/public" ]; then
    echo "❌ Directory $VPS_DIR/public non trovata!"
    echo "   Creo la directory..."
    mkdir -p "$VPS_DIR/public"
fi

echo "📄 Il file app.html verrà creato da un file base64"
echo "   Dimensione file: ~220KB (base64 encoded)"
echo ""
echo "⚠️  IMPORTANTE:"
echo "   1. Trasferisci il file app.html.base64 sul VPS"
echo "   2. Poi esegui: base64 -d app.html.base64 > $OUTPUT_FILE"
echo ""
echo "   Oppure usa questo comando dal Raspberry Pi:"
echo "   scp public/app.html root@VPS_IP:$OUTPUT_FILE"
echo ""


