param([Parameter(Mandatory=$true)][string]$SnapshotFile,[string]$BaseUrl='http://localhost:4000',[System.Management.Automation.PSCredential]$Credential)
$ErrorActionPreference='Stop'
$path=(Resolve-Path -LiteralPath $SnapshotFile).Path
if(Test-Path -LiteralPath "$path.sha256"){$expected=(Get-Content -LiteralPath "$path.sha256" -Raw).Trim();if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -ne $expected){throw 'Export checksum does not match.'}}
$raw=Get-Content -LiteralPath $path -Raw;$snapshot=$raw|ConvertFrom-Json
if($snapshot.format -ne 'marble-application-export-v1'){throw 'Unsupported export format.'}
foreach($resource in @('categories','clients','suppliers','products','factures','bon-achat','payments')){foreach($row in $snapshot.$resource){if(-not $row.id -or $row -is [Array]){throw 'Use the verified preview-preserved export, not the earlier nested-payment export.'}}}
$health=Invoke-RestMethod -Uri "$BaseUrl/health" -TimeoutSec 15
if($health.storage -ne 'persistent' -or $health.databaseEngine -ne 'H2'){throw 'Start the permanent local backend before importing.'}
if(-not $Credential){$Credential=Get-Credential -Message 'Permanent local application administrator login'}
$login=@{username=$Credential.UserName;password=$Credential.GetNetworkCredential().Password}|ConvertTo-Json
$session=Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body $login -TimeoutSec 15
$headers=@{Authorization="Bearer $($session.token)"}
$result=Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/local-data/import" -Headers $headers -ContentType 'application/json; charset=utf-8' -Body ([Text.Encoding]::UTF8.GetBytes($raw)) -TimeoutSec 120
Write-Output ('Imported '+$result.documents+' documents, '+$result.lines+' lines and '+$result.payments+' payments into the empty local database.')
