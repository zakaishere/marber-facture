param([switch]$Preview,[switch]$Postgres)
$ErrorActionPreference = 'Stop'
if($Preview -and $Postgres){throw 'Choose Preview or Postgres, not both.'}
if(-not $Preview){
    $envPath=Join-Path $PSScriptRoot '.env'
    if(-not(Test-Path -LiteralPath $envPath)){& (Join-Path $PSScriptRoot 'configure-live.ps1')}
    foreach($line in Get-Content -LiteralPath $envPath){
        if($line -match '^(DB_PASSWORD|APP_ADMIN_USERNAME|APP_ADMIN_PASSWORD|APP_JWT_SECRET|APP_DEMO_ENABLED)=(.*)$'){
            [Environment]::SetEnvironmentVariable($Matches[1],$Matches[2],'Process')
        }
    }
    if(-not $env:DB_URL){$env:DB_URL='jdbc:postgresql://localhost:5433/marble_invoicing'}
    if(-not $env:DB_USERNAME){$env:DB_USERNAME='marble'}
}
$portableRoot = Join-Path $env:TEMP 'opencode/tooling'
$javaReady = $false
if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin/javac.exe'))) {
    $javaVersion = & (Join-Path $env:JAVA_HOME 'bin/javac.exe') -version 2>&1
    $javaReady = "$javaVersion" -match 'javac (2[1-9]|[3-9][0-9])\.'
}
if (-not $javaReady) {
    $portableJdk = Get-ChildItem (Join-Path $portableRoot 'jdk') -Directory -ErrorAction SilentlyContinue | Where-Object { Test-Path (Join-Path $_.FullName 'bin/javac.exe') } | Select-Object -First 1
    if ($portableJdk) { $env:JAVA_HOME = $portableJdk.FullName; $javaReady = $true }
}
if (-not $javaReady) { throw 'Set JAVA_HOME to a JDK 21 installation (Java 8/JRE alone cannot run this app).' }
$mavenArgs = @('spring-boot:run')
if ($Preview) {
    Write-Host 'PREVIEW: temporary in-memory database. Data resets when this process stops.' -ForegroundColor Yellow
    $mavenArgs += @('-Dspring-boot.run.useTestClasspath=true', '-Dspring-boot.run.profiles=preview')
}elseif($Postgres){$mavenArgs += '-Dspring-boot.run.profiles=live'}else{
    Write-Host 'LOCAL: permanent database in backend/data/marble.mv.db. No Docker required.' -ForegroundColor Green
    $mavenArgs += '-Dspring-boot.run.profiles=local'
}
Push-Location (Join-Path $PSScriptRoot 'backend')
try {
    $portableMaven = Join-Path $portableRoot 'maven/apache-maven-3.9.9/bin/mvn.cmd'
    if (Test-Path $portableMaven) {
        & $portableMaven "-Dmaven.repo.local=$(Join-Path $portableRoot 'm2')" @mavenArgs
    } else { & '.\mvnw.cmd' @mavenArgs }
    if ($LASTEXITCODE -ne 0) { throw 'Backend startup failed. Check Java 21 and the database connection in the messages above.' }
} finally { Pop-Location }
