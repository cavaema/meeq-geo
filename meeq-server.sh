#!/bin/bash
# 🚀 AVVIO SERVER MEEQ
# ====================
# Script per avviare il server senza PM2

# Configurazione
SERVER_DIR="/home/meeq/meeq"
LOG_FILE="/home/meeq/meeq/server.log"
PID_FILE="/home/meeq/meeq/server.pid"

# Funzioni
start_server() {
    echo "🚀 Avvio server Meeq..."
    
    # Controlla se già attivo
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "⚠️  Server già attivo (PID: $PID)"
            return 1
        fi
    fi
    
    # Avvia il server
    cd "$SERVER_DIR"
    nohup node server.js > "$LOG_FILE" 2>&1 &
    PID=$!
    echo $PID > "$PID_FILE"
    
    sleep 2
    
    # Verifica avvio
    if ps -p "$PID" > /dev/null; then
        echo "✅ Server avviato (PID: $PID)"
        echo "📋 Log: tail -f $LOG_FILE"
        return 0
    else
        echo "❌ Server non si è avviato. Controlla i log:"
        tail -20 "$LOG_FILE"
        return 1
    fi
}

stop_server() {
    echo "🛑 Fermo server Meeq..."
    
    # Prima prova con PID file
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill "$PID" 2>/dev/null; then
            echo "✅ Server fermato (PID: $PID)"
            rm -f "$PID_FILE"
            return 0
        fi
    fi
    
    # Altrimenti killa tutti i processi node server.js
    if pkill -f "node server.js"; then
        echo "✅ Server fermato"
        rm -f "$PID_FILE"
        return 0
    else
        echo "⚠️  Nessun server da fermare"
        return 1
    fi
}

restart_server() {
    echo "🔄 Riavvio server Meeq..."
    stop_server
    sleep 2
    start_server
}

status_server() {
    echo "📊 STATUS SERVER MEEQ"
    echo "===================="
    
    # Controlla PID
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if ps -p "$PID" > /dev/null 2>&1; then
            echo "✅ Server ATTIVO (PID: $PID)"
            
            # Mostra info processo
            ps -p "$PID" -o pid,vsz,rss,comm,etime
            
            # Test API
            if curl -s http://localhost:3000 > /dev/null 2>&1; then
                echo "✅ API risponde su http://localhost:3000"
            else
                echo "⚠️  API non risponde"
            fi
            
            # Ultimi log
            echo ""
            echo "📋 Ultimi 5 log:"
            tail -5 "$LOG_FILE"
        else
            echo "❌ Server NON ATTIVO (PID file obsoleto)"
            rm -f "$PID_FILE"
        fi
    else
        echo "❌ Server NON ATTIVO (nessun PID file)"
    fi
    
    # Cerca processi node comunque
    echo ""
    echo "🔍 Processi Node attivi:"
    ps aux | grep "[n]ode server.js" || echo "Nessuno"
}

# Menu principale
case "$1" in
    start)
        start_server
        ;;
    stop)
        stop_server
        ;;
    restart)
        restart_server
        ;;
    status)
        status_server
        ;;
    log)
        tail -f "$LOG_FILE"
        ;;
    *)
        echo "Uso: $0 {start|stop|restart|status|log}"
        echo ""
        echo "Comandi:"
        echo "  start   - Avvia il server"
        echo "  stop    - Ferma il server"
        echo "  restart - Riavvia il server"
        echo "  status  - Mostra stato del server"
        echo "  log     - Mostra log in tempo reale"
        exit 1
        ;;
esac
