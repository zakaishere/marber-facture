param([string]$OutputDirectory=(Join-Path $PSScriptRoot 'backups'))
$ErrorActionPreference='Stop'
Push-Location $PSScriptRoot
try{
    New-Item -ItemType Directory -Force -Path $OutputDirectory|Out-Null
    $name='marble-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8)+'.dump'
    $destination=Join-Path (Resolve-Path -LiteralPath $OutputDirectory).Path $name
    & docker compose exec -T db pg_dump -U marble -d marble_invoicing --format=custom "--file=/tmp/$name"
    if($LASTEXITCODE -ne 0){throw 'Database backup failed; no successful backup has been recorded.'}
    & docker compose exec -T db pg_restore --list "/tmp/$name" | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Backup archive validation failed.'}
    & docker compose cp "db:/tmp/$name" $destination
    if($LASTEXITCODE -ne 0 -or -not(Test-Path -LiteralPath $destination)){throw 'Backup could not be copied to your computer.'}
    (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash|Set-Content -LiteralPath "$destination.sha256"
    & docker compose exec -T db rm -- "/tmp/$name"
    Write-Output "Backup created and archive structure checked: $destination"
    Write-Output 'Run verify-backup.ps1 for a full restore test. Keep another private copy on a different device.'
}finally{Pop-Location}
