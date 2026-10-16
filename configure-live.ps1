param()
$ErrorActionPreference='Stop'
$envPath=Join-Path $PSScriptRoot '.env'
if(Test-Path -LiteralPath $envPath){throw '.env already exists; it has been left unchanged.'}
function New-Secret([int]$Length){$bytes=New-Object byte[] $Length;$rng=[System.Security.Cryptography.RandomNumberGenerator]::Create();try{$rng.GetBytes($bytes)}finally{$rng.Dispose()};return -join ($bytes|ForEach-Object {$_.ToString('x2')})}
@("DB_PASSWORD=$(New-Secret 24)","APP_ADMIN_USERNAME=admin","APP_ADMIN_PASSWORD=$(New-Secret 16)","APP_JWT_SECRET=$(New-Secret 48)",'APP_DEMO_ENABLED=false')|Set-Content -LiteralPath $envPath -Encoding ascii
Write-Output "Created private configuration: $envPath"
Write-Output 'Read APP_ADMIN_PASSWORD there for your first live login. Never commit or share this file.'
