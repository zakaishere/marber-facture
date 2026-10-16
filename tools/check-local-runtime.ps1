param([string]$BaseUrl='http://127.0.0.1:4000',[switch]$SkipBackup)
$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
$config=@{}
Get-Content -LiteralPath (Join-Path $appRoot '.env')|ForEach-Object {if($_ -match '^([A-Z_]+)=(.*)$'){$config[$Matches[1]]=$Matches[2]}}
$health=Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 15
if($health.databaseEngine -ne 'H2' -or $health.storage -ne 'persistent'){throw 'Expected permanent local storage.'}
$body=@{username=$config['APP_ADMIN_USERNAME'];password=$config['APP_ADMIN_PASSWORD']}|ConvertTo-Json
$login=Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body $body -TimeoutSec 15
$headers=@{Authorization="Bearer $($login.token)";Accept='application/json'}
$dashboard=Invoke-RestMethod -Uri "$BaseUrl/dashboard" -Headers $headers -TimeoutSec 15
$source=Get-ChildItem -LiteralPath (Join-Path $appRoot 'backups') -Filter 'preview-preserved-*.json'|Sort-Object LastWriteTime -Descending|Select-Object -First 1
if($source){
    $snapshot=Get-Content -LiteralPath $source.FullName -Raw|ConvertFrom-Json
    foreach($resource in @('factures','bon-achat')){foreach($saved in $snapshot.$resource){
        $actual=Invoke-RestMethod -Uri "$BaseUrl/$resource/$($saved.id)" -Headers $headers -TimeoutSec 15
        $key=if($resource -eq 'factures'){'totalTtc'}else{'totalAmount'}
        if($actual.code -ne $saved.code -or [decimal]$actual.$key -ne [decimal]$saved.$key -or [decimal]$actual.paidAmount -ne [decimal]$saved.paidAmount -or @($actual.items).Count -ne @($saved.items).Count){throw 'A preserved document does not match the saved export.'}
        for($i=0;$i -lt @($saved.items).Count;$i++){foreach($field in @('length','width','quantity','surface','subtotalAfter')){if($actual.items[$i].$field -ne $saved.items[$i].$field){throw 'A preserved document line changed.'}}}
    }}
}
$page=Invoke-RestMethod -Uri "$BaseUrl/factures?paged=true&pageSize=2" -Headers $headers -TimeoutSec 15
if($page.total -ne $dashboard.invoiceCount -or @($page.data).Count -gt 2){throw 'Pagination/dashboard count mismatch'}
$frontend=Invoke-RestMethod -Uri 'http://localhost:8080/dashboard' -Headers $headers -TimeoutSec 15
if([decimal]$frontend.sales -ne [decimal]$dashboard.sales){throw 'Frontend proxy and backend totals differ.'}
Write-Output ('LOCAL CHECK PASSED: persistent file, saved document IDs/numbers/dimensions/payments, exact pagination and frontend connection. Invoices: '+$dashboard.invoiceCount)
if(-not $SkipBackup){
    $backup=Join-Path $appRoot ('backups/local-check-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.zip')
    Invoke-WebRequest -Method Post -Uri "$BaseUrl/auth/local-data/backup" -ContentType 'application/json' -Body '{}' -Headers $headers -OutFile $backup -TimeoutSec 60|Out-Null
    & (Join-Path $appRoot 'verify-local-backup.ps1') -BackupFile $backup
}
