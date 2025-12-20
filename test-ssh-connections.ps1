# Script PowerShell per testare connessioni SSH dal PC
# Eseguire da PowerShell sul PC locale

Write-Host "🔍 Test Connessioni SSH" -ForegroundColor Cyan
Write-Host "======================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Verifica chiavi SSH
Write-Host "1. Verifica chiavi SSH:" -ForegroundColor Yellow
$keyRaspberry = "C:\Users\ec\.ssh\id_raspberry"
$keyVPS = "C:\Users\ec\.ssh\id_ed25519"

if (Test-Path $keyRaspberry) {
    Write-Host "   ✅ id_raspberry trovata" -ForegroundColor Green
} else {
    Write-Host "   ❌ id_raspberry NON trovata: $keyRaspberry" -ForegroundColor Red
}

if (Test-Path $keyVPS) {
    Write-Host "   ✅ id_ed25519 trovata" -ForegroundColor Green
} else {
    Write-Host "   ❌ id_ed25519 NON trovata: $keyVPS" -ForegroundColor Red
}

Write-Host ""

# Test 2: Verifica config SSH
Write-Host "2. Verifica config SSH:" -ForegroundColor Yellow
$configPath = "C:\Users\ec\.ssh\config"
if (Test-Path $configPath) {
    Write-Host "   ✅ Config trovato: $configPath" -ForegroundColor Green
    $config = Get-Content $configPath
    if ($config -match "Host meeq-pi") {
        Write-Host "   ✅ meeq-pi configurato" -ForegroundColor Green
    } else {
        Write-Host "   ❌ meeq-pi NON configurato" -ForegroundColor Red
    }
    if ($config -match "Host meeq-vps") {
        Write-Host "   ✅ meeq-vps configurato" -ForegroundColor Green
    } else {
        Write-Host "   ❌ meeq-vps NON configurato" -ForegroundColor Red
    }
} else {
    Write-Host "   ❌ Config NON trovato: $configPath" -ForegroundColor Red
}

Write-Host ""

# Test 3: Test connessione Raspberry Pi
Write-Host "3. Test connessione Raspberry Pi (meeq-pi):" -ForegroundColor Yellow
try {
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes meeq-pi "echo 'OK'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Connessione OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Connessione FALLITA" -ForegroundColor Red
        Write-Host "   Output: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Errore: $_" -ForegroundColor Red
}

Write-Host ""

# Test 4: Test connessione VPS
Write-Host "4. Test connessione VPS (meeq-vps):" -ForegroundColor Yellow
try {
    $result = ssh -o ConnectTimeout=5 -o BatchMode=yes meeq-vps "echo 'OK'" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Connessione OK" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Connessione FALLITA" -ForegroundColor Red
        Write-Host "   Output: $result" -ForegroundColor Red
    }
} catch {
    Write-Host "   ❌ Errore: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Test completato!" -ForegroundColor Cyan

