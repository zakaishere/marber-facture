param([string]$BaseUrl='http://localhost:4000',[System.Management.Automation.PSCredential]$Credential,[string]$OutputDirectory=(Join-Path $PSScriptRoot 'backups'))
$ErrorActionPreference='Stop'
if(-not $Credential){$Credential=Get-Credential -Message 'Current application login for preserving preview data'}
$login=@{username=$Credential.UserName;password=$Credential.GetNetworkCredential().Password}|ConvertTo-Json
$session=Invoke-RestMethod -Method Post -Uri "$BaseUrl/auth/login" -ContentType 'application/json' -Body $login
$headers=@{Authorization="Bearer $($session.token)"}
function Read-All([string]$Resource){
    $rows=[System.Collections.Generic.List[object]]::new();$page=1
    do {
        $response=Invoke-RestMethod -Uri "$BaseUrl/${Resource}?page=$page&pageSize=250&includeItems=true" -Headers $headers
        $chunk=if($response -is [Array]){@($response)}elseif($null -eq $response){@()}elseif($response.PSObject.Properties.Name -contains 'data'){@($response.data)}else{throw "Unexpected export response: $Resource"}
        foreach($row in $chunk){if(-not $row.id){throw "Missing record ID in $Resource"};$rows.Add($row)}
        $page++
    }while($chunk.Count -eq 250)
    return ,$rows.ToArray()
}
$snapshot=[ordered]@{format='marble-application-export-v1';createdAt=(Get-Date).ToUniversalTime().ToString('o');profile=(Invoke-RestMethod -Uri "$BaseUrl/auth/verify" -Headers $headers).user}
foreach($resource in @('categories','clients','suppliers','products','factures','bon-achat')){$snapshot[$resource]=Read-All $resource}
$payments=[System.Collections.Generic.List[object]]::new()
foreach($resource in @('factures','bon-achat')){
    foreach($doc in $snapshot[$resource]){
        $history=Invoke-RestMethod -Uri "$BaseUrl/$resource/$($doc.id)/payments" -Headers $headers
        [decimal]$paid=0
        foreach($payment in $history){if(-not $payment.id){throw 'Payment export contains a missing ID'};$payments.Add($payment);$paid += [decimal]$payment.amount}
        if($paid -ne [decimal]$doc.paidAmount){throw "Payment totals changed during export. Pause data entry and retry: $resource"}
    }
}
$snapshot.payments=$payments.ToArray()
$folder=$OutputDirectory;New-Item -ItemType Directory -Force -Path $folder|Out-Null
$path=Join-Path $folder ('preview-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.json')
$snapshot|ConvertTo-Json -Depth 40|Set-Content -LiteralPath $path -Encoding utf8
$verified=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
foreach($resource in @('categories','clients','suppliers','products','factures','bon-achat','payments')){if(@($verified.$resource).Count -ne @($snapshot[$resource]).Count){throw "Export verification failed: $resource"}}
(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash|Set-Content -LiteralPath "$path.sha256"
Write-Output "Preserved application records: $path"
Write-Output ('Invoices: '+@($snapshot.factures).Count+'; purchases: '+@($snapshot['bon-achat']).Count+'; payments: '+$payments.Count)
Write-Output 'This application export excludes password hashes. Keep it private. It is not a PostgreSQL backup or an automatic migration.'


