param([Parameter(Mandatory=$true)][string]$BackupFile,[string]$DestinationDirectory)
$ErrorActionPreference='Stop'
$archive=(Resolve-Path -LiteralPath $BackupFile).Path
if(-not $DestinationDirectory){$DestinationDirectory=Join-Path $PSScriptRoot ('backend/data/restored-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[Guid]::NewGuid().ToString('N').Substring(0,8))}
$target=[IO.Path]::GetFullPath($DestinationDirectory)
if(Test-Path -LiteralPath $target){throw 'Restore target already exists. Nothing has been overwritten.'}
$envPath=Join-Path $PSScriptRoot '.env'
foreach($line in Get-Content -LiteralPath $envPath){if($line -match '^DB_PASSWORD=(.*)$'){$env:DB_PASSWORD=$Matches[1]}}
$javaPath=if($env:JAVA_HOME){Join-Path $env:JAVA_HOME 'bin/java.exe'}else{$null}
$tooling=Join-Path $env:TEMP 'opencode/tooling'
if(-not $javaPath -or -not(Test-Path -LiteralPath $javaPath)){$jdk=Get-ChildItem (Join-Path $tooling 'jdk') -Directory -ErrorAction SilentlyContinue|Select-Object -First 1;if($jdk){$javaPath=Join-Path $jdk.FullName 'bin/java.exe'}}
if(-not $javaPath -or -not(Test-Path -LiteralPath $javaPath)){throw 'JDK 21 is required, as for the backend launcher.'}
$repositories=@((Join-Path $tooling 'm2/com/h2database/h2'),(Join-Path $env:USERPROFILE '.m2/repository/com/h2database/h2'))
$jar=$null
foreach($repository in $repositories){if(Test-Path -LiteralPath $repository){$jar=Get-ChildItem -LiteralPath $repository -Recurse -Filter 'h2-*.jar'|Where-Object {$_.Name -notmatch 'sources|javadoc'}|Sort-Object LastWriteTime -Descending|Select-Object -First 1;if($jar){break}}}
if(-not $jar){throw 'Start/build the backend once so its H2 dependency is available.'}
& $javaPath --class-path $jar.FullName (Join-Path $PSScriptRoot 'tools/VerifyLocalBackup.java') $archive $target
if($LASTEXITCODE -ne 0){throw 'Backup restore verification failed. The live database was not modified.'}
