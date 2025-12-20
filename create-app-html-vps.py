#!/usr/bin/env python3
"""
Script per creare app.html sul VPS
Esegui questo script SUL VPS (non sul Raspberry Pi)

Uso:
    1. Trasferisci questo script sul VPS
    2. Trasferisci anche app.html (o app.html.base64)
    3. Esegui: python3 create-app-html-vps.py
"""

import os
import base64
import sys

VPS_DIR = "/opt/meeq-central"
OUTPUT_FILE = os.path.join(VPS_DIR, "public", "app.html")

def create_from_file():
    """Crea app.html da un file locale"""
    source_file = "app.html"
    if not os.path.exists(source_file):
        print(f"❌ File {source_file} non trovato nella directory corrente")
        print(f"   Assicurati di essere nella directory dove hai copiato app.html")
        return False
    
    print(f"📄 Leggo {source_file}...")
    with open(source_file, 'rb') as f:
        content = f.read()
    
    # Crea directory se non esiste
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    # Scrivi il file
    print(f"💾 Scrivo {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'wb') as f:
        f.write(content)
    
    print(f"✅ File creato con successo!")
    print(f"   Dimensione: {len(content)} bytes")
    return True

def create_from_base64():
    """Crea app.html da un file base64"""
    source_file = "app.html.base64"
    if not os.path.exists(source_file):
        return False
    
    print(f"📄 Leggo {source_file}...")
    with open(source_file, 'r') as f:
        b64_content = f.read()
    
    # Decodifica
    print("🔓 Decodifico base64...")
    content = base64.b64decode(b64_content)
    
    # Crea directory se non esiste
    os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
    
    # Scrivi il file
    print(f"💾 Scrivo {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'wb') as f:
        f.write(content)
    
    print(f"✅ File creato con successo!")
    print(f"   Dimensione: {len(content)} bytes")
    return True

if __name__ == "__main__":
    print("🚀 Creazione app.html sul VPS")
    print("=" * 40)
    
    # Prova prima con file normale
    if create_from_file():
        sys.exit(0)
    
    # Se non funziona, prova con base64
    if create_from_base64():
        sys.exit(0)
    
    print("\n❌ Nessun file sorgente trovato!")
    print("\n📝 Istruzioni:")
    print("   1. Trasferisci app.html sul VPS (nella stessa directory di questo script)")
    print("   2. Oppure trasferisci app.html.base64")
    print("   3. Esegui: python3 create-app-html-vps.py")
    print("\n   Trasferimento file:")
    print("   scp public/app.html root@VPS_IP:/root/")
    sys.exit(1)


