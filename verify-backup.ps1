param([Parameter(Mandatory=$true)][string]$BackupFile)
$ErrorActionPreference='Stop'
$file=(Resolve-Path -LiteralPath $BackupFile).Path
if(Test-Path -LiteralPath "$file.sha256"){
    $expected=(Get-Content -LiteralPath "$file.sha256" -Raw).Trim()
    if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $expected){throw 'Backup checksum does not match. No restore attempted.'}
}
$name='verify_backup_'+(Get-Date -Format 'yyyyMMddHHmmss')+'_'+[Guid]::NewGuid().ToString('N').Substring(0,8)
if($name -notmatch '^verify_backup_[0-9]{14}_[a-f0-9]{8}$'){throw 'Invalid verification database name.'}
$created=$false
Push-Location $PSScriptRoot
try{
    & docker compose cp $file "db:/tmp/$name.dump";if($LASTEXITCODE -ne 0){throw 'Could not copy archive.'}
    & docker compose exec -T db createdb -U marble $name;if($LASTEXITCODE -ne 0){throw 'Could not create a separate verification database.'};$created=$true
    & docker compose exec -T db pg_restore -U marble --exit-on-error --single-transaction -d $name "/tmp/$name.dump"
    if($LASTEXITCODE -ne 0){throw 'Restore verification failed.'}
    & docker compose exec -T db psql -U marble -d $name -v ON_ERROR_STOP=1 -c 'SELECT (SELECT COUNT(*) FROM factures) AS invoices,(SELECT COUNT(*) FROM bon_achats) AS purchases,(SELECT COUNT(*) FROM payments) AS payments;'
    if($LASTEXITCODE -ne 0){throw 'Restored data verification failed.'}
    Write-Output 'Full archive restore succeeded in an isolated verification database.'
}finally{
    if($created){& docker compose exec -T db dropdb -U marble $name}
    & docker compose exec -T db rm -f -- "/tmp/$name.dump"
    Pop-Location
}
