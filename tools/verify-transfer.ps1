# Exercises real export/import code with empty and multiple-payment API responses, never a live database.
$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
$folder=Join-Path $appRoot ('backups/transfer-check-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $folder|Out-Null
$profile=[pscustomobject]@{id='test-admin';username='admin';company=[pscustomobject]@{name="Pierre d'Atlas";activity='Marbre';address='Tanger';phone_fix='0539000000';phone_mobile='';phone_whatsapp='0600630043';email='test@example.test';rc='TEST';if='TEST';ice='001234567890123';patente='';cnss=''}}
$client=[pscustomobject]@{id='test-client';name='Client test';phone='';address='Tanger';ice='';createdAt='2026-10-16T01:00:00';updatedAt='2026-10-16T01:00:00'}
$category=[pscustomobject]@{id='test-category';name='Marbre';createdAt=$client.createdAt;updatedAt=$client.updatedAt}
$product=[pscustomobject]@{id='test-product';name='Marbre';code='TEST';categoryId=$category.id;salePrice=120;lastPurchasePrice=100;tvaRate=0.2;quantity=0;minStock=0;createdAt=$client.createdAt;updatedAt=$client.updatedAt}
$docs=@(foreach($i in 1..3){[pscustomobject]@{id="test-invoice-$i";code="261000$i";date='2026-10-16';clientId=$client.id;client=$client;company=$profile.company;status='NOT_DECLARED';paymentMethod='ESPECE';totalHt=100;totalTva=20;totalTtc=120;paidAmount=$(if($i -eq 2){120}elseif($i -eq 3){30}else{0});createdAt=$client.createdAt;updatedAt=$client.updatedAt;items=@([pscustomobject]@{id="test-line-$i";productId=$product.id;product=$product;length=100;width=100;dimensionUnit='CM';quantity=1;surface=1;unitPriceTtc=120;tvaRate=0.2;lineTotalHt=100;lineTotalTva=20;lineTotalTtc=120;subtotalAfter=$false;createdAt=$client.createdAt;updatedAt=$client.updatedAt})}})
$fixturePayments=@(foreach($i in 1..3){[pscustomobject]@{id="test-payment-$i";factureId=$(if($i -eq 3){$docs[2].id}else{$docs[1].id});bonAchatId=$null;amount=$(if($i -eq 3){30}else{60});method='ESPECE';date='2026-10-16T01:00:00';note="D'accord";reference='TEST';createdAt=$client.createdAt;updatedAt=$client.updatedAt}})
$catalog=@{categories=@($category);clients=@($client);suppliers=@();products=@($product);factures=$docs;'bon-achat'=@()}
function Invoke-RestMethod {
    param($Method,$Uri,$ContentType,$Body,$Headers)
    if($Uri -match '/auth/login$'){return [pscustomobject]@{token='fixture-token'}}
    if($Uri -match '/auth/verify$'){return [pscustomobject]@{user=$profile}}
    if($Uri -match '/factures/([^/]+)/payments$'){$documentId=$Matches[1];return ,@($fixturePayments|Where-Object {$_.factureId -eq $documentId})}
    if($Uri -match '/([^/?]+)\?'){$resource=$Matches[1];if($catalog.ContainsKey($resource)){return ,$catalog[$resource]}}
    throw "Unexpected test URL: $Uri"
}
try{
    $credential=New-Object System.Management.Automation.PSCredential('fixture',(ConvertTo-SecureString 'fixture' -AsPlainText -Force))
    & (Join-Path $appRoot 'export-preview.ps1') -Credential $credential -OutputDirectory $folder
    $file=Get-ChildItem -LiteralPath $folder -Filter '*.json'|Select-Object -First 1
    $saved=Get-Content -LiteralPath $file.FullName -Raw|ConvertFrom-Json
    if(@($saved.payments).Count -ne 3 -or @($saved.factures).Count -ne 3){throw 'Transfer lost payment/document records'}
    foreach($payment in $saved.payments){if($payment -is [Array] -or -not $payment.id){throw 'Nested/missing payment in export'}}
    & (Join-Path $appRoot 'import-preview.ps1') -SnapshotFile $file.FullName -PrepareOnly -OutputDirectory $folder
    $sqlFile=Get-ChildItem -LiteralPath $folder -Filter '*.sql'|Select-Object -First 1
    $sql=Get-Content -LiteralPath $sqlFile.FullName -Raw
    if(-not $sql.Contains("company_phone_whatsapp='0600630043'")){throw 'WhatsApp contact missing from transfer SQL'}
    if(([regex]::Matches($sql,'INSERT INTO payments ')).Count -ne 3 -or -not $sql.Contains("Pierre d''Atlas") -or -not $sql.Contains('BEGIN;') -or -not $sql.Contains('COMMIT;')){throw 'Import SQL fidelity check failed'}
    $saved.payments=@(@($saved.payments));$saved.payments[0]=$null
    $invalid=Join-Path $folder 'invalid.json';$saved|ConvertTo-Json -Depth 40|Set-Content -LiteralPath $invalid -Encoding utf8
    $rejected=$false
    try{& (Join-Path $appRoot 'import-preview.ps1') -SnapshotFile $invalid -PrepareOnly -OutputDirectory $folder}catch{$rejected=$true}
    if(-not $rejected){throw 'Malformed payment export was not rejected'}
    Write-Output 'TRANSFER CHECK PASSED: empty/multiple payments, paid totals, IDs, JSON fidelity, SQL escaping, malformed-import rejection.'
}finally{
    # Only this invocation's unique fixture directory; no business backup is deleted.
    $resolved=(Resolve-Path -LiteralPath $folder).Path
    $backupRoot=[IO.Path]::GetFullPath((Join-Path $appRoot 'backups'))+[IO.Path]::DirectorySeparatorChar
    if(-not $resolved.StartsWith($backupRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected fixture directory'}
    foreach($file in Get-ChildItem -LiteralPath $resolved -File){Remove-Item -LiteralPath $file.FullName}
    Remove-Item -LiteralPath $resolved
}

