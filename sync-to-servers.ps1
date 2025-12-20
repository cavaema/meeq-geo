# Script PowerShell per sincronizzare le modifiche dal PC ai server
# Eseguire dal PC dopo git push

Write-Host "🔄 Sincronizzazione Repository Meeq" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

function Sync-Repo {
    param(
        [string]$RepoName,
        [string]$ServerHost,
        [string]$ServerPath,
        [string]$ServerUser
    )
    
    Write-Host "Sincronizzazione $RepoName..." -ForegroundColor Yellow
    
    # Verifica che il repository esista localmente
    if (-not (Test-Path $RepoName)) {
        Write-Host "  ❌ Repository $RepoName non trovato localmente" -ForegroundColor Red
        return $false
    }
    
    Push-Location $RepoName
    
    # Push al repository remoto (GitHub/GitLab)
    Write-Host "  📤 Push a GitHub/GitLab..." -ForegroundColor Gray
    $pushResult = git push 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Push completato" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Errore durante push" -ForegroundColor Red
        Write-Host $pushResult -ForegroundColor Red
        Pop-Location
        return $false
    }
    
    # Pull sul server
    Write-Host "  📥 Pull sul server ($ServerHost)..." -ForegroundColor Gray
    $pullCommand = "cd $ServerPath && git pull"
    $pullResult = ssh "${ServerUser}@${ServerHost}" $pullCommand 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "  ✅ Pull completato sul server" -ForegroundColor Green
        
        # Riavvia servizio se necessario
        if ($RepoName -eq "meeq-local") {
            Write-Host "  🔄 Riavvio servizio meeq..." -ForegroundColor Gray
            ssh "${ServerUser}@${ServerHost}" "sudo systemctl restart meeq" 2>&1 | Out-Null
        } elseif ($RepoName -eq "meeq-central") {
            Write-Host "  🔄 Riavvio servizio meeq-central..." -ForegroundColor Gray
            ssh "${ServerUser}@${ServerHost}" "sudo systemctl restart meeq-central" 2>&1 | Out-Null
        }
    } else {
        Write-Host "  ❌ Errore durante pull sul server" -ForegroundColor Red
        Write-Host $pullResult -ForegroundColor Red
        Pop-Location
        return $false
    }
    
    Pop-Location
    Write-Host ""
    return $true
}

# Sincronizza repository locale (Raspberry Pi)
Sync-Repo -RepoName "meeq-local" -ServerHost "172.16.0.10" -ServerPath "/home/meeq/meeq" -ServerUser "meeq"

# Sincronizza repository centrale (VPS)
Sync-Repo -RepoName "meeq-central" -ServerHost "128.140.84.82" -ServerPath "/opt/meeq-central" -ServerUser "root"

Write-Host "✅ Sincronizzazione completata!" -ForegroundColor Green

