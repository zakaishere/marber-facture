param([string]$BaseUrl='http://127.0.0.1:4000',[pscredential]$Credential)
$ErrorActionPreference='Stop'
$appRoot=Split-Path $PSScriptRoot -Parent
if(-not $Credential){
    $settings=@{}
    Get-Content -LiteralPath (Join-Path $appRoot '.env') | ForEach-Object {if($_ -match '^([A-Z_]+)=(.*)$'){$settings[$Matches[1]]=$Matches[2]}}
    $Credential=[pscredential]::new($settings.APP_ADMIN_USERNAME,(ConvertTo-SecureString $settings.APP_ADMIN_PASSWORD -AsPlainText -Force))
}
$loginBody=@{username=$Credential.UserName;password=$Credential.GetNetworkCredential().Password}|ConvertTo-Json
$login=Invoke-RestMethod "$BaseUrl/auth/login" -Method Post -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($loginBody))
$headers=@{Authorization="Bearer $($login.token)";Accept='application/json'}
function Ensure-Record([string]$resource,[string]$field,[string]$value,[hashtable]$body){
    $search=[Uri]::EscapeDataString($value)
    $rows=Invoke-RestMethod "$BaseUrl/${resource}?search=$search&limit=10000" -Headers $headers
    $found=@($rows | Where-Object {$_.$field -eq $value})
    if($found.Count -gt 1){throw "More than one matching TEST record in $resource; no existing records were edited."}
    if($found.Count -eq 1){return $found[0]}
    return Invoke-RestMethod "$BaseUrl/$resource" -Method Post -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes(($body|ConvertTo-Json -Depth 12)))
}
$health=Invoke-RestMethod "$BaseUrl/health"
if($health.databaseEngine -eq 'H2' -and $health.storage -eq 'persistent'){
    $backup=Join-Path $appRoot ('backups/before-test-data-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.zip')
    Invoke-WebRequest "$BaseUrl/auth/local-data/backup" -Method Post -Headers $headers -OutFile $backup | Out-Null
    Write-Output 'Local database backed up before adding test records.'
}
$category=Ensure-Record 'categories' 'name' 'TEST - Marbres pour essais' @{name='TEST - Marbres pour essais'}
$supplier=Ensure-Record 'suppliers' 'name' 'TEST - Fournisseur de marbre' @{name='TEST - Fournisseur de marbre';address='Donnees fictives pour essais'}
foreach($name in @('TEST - Atelier Atlas','TEST - Riad Tanger','TEST - Entreprise Batiment')){
    Ensure-Record 'clients' 'name' $name @{name=$name;address='Tanger - donnees fictives pour essais'} | Out-Null
}
$definitions=@(
    @{code='TEST-MAR-HAL';name='TEST - New Halayeb';salePrice=200;lastPurchasePrice=150;length=323;width=71;quantity=50},
    @{code='TEST-MAR-CRE';name='TEST - Crema Silvia';salePrice=140;lastPurchasePrice=100;length=279;width=155;quantity=30},
    @{code='TEST-MAR-NOI';name='TEST - Noir Galaxy';salePrice=450;lastPurchasePrice=300;length=300;width=180;quantity=20}
)
$lines=@();$products=@()
foreach($definition in $definitions){
    $product=Ensure-Record 'products' 'code' $definition.code @{code=$definition.code;name=$definition.name;categoryId=$category.id;salePrice=$definition.salePrice;lastPurchasePrice=$definition.lastPurchasePrice;tvaPercent=20}
    $products+=$product
    $lines+=@{productId=$product.id;length=$definition.length;width=$definition.width;dimensionUnit='CM';quantity=$definition.quantity;unitPrice=$definition.lastPurchasePrice;tvaPercent=20;subtotalAfter=$true}
}
$code='TEST-ACHAT-001';$purchase=$null
try{$purchase=Invoke-RestMethod "$BaseUrl/bon-achat/by-code/$code" -Headers $headers}
catch{if([int]$_.Exception.Response.StatusCode -ne 404){throw}}
if(-not $purchase){
    $date=[TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([DateTimeOffset]::UtcNow,'Africa/Casablanca').ToString('yyyy-MM-dd')
    $body=@{supplierId=$supplier.id;code=$code;date=$date;paymentMethod='CASH';items=$lines}|ConvertTo-Json -Depth 12
    $purchase=Invoke-RestMethod "$BaseUrl/bon-achat" -Method Post -Headers $headers -ContentType 'application/json' -Body ([Text.Encoding]::UTF8.GetBytes($body))
}
Write-Output 'TEST records ready: 3 clients, 1 supplier, 3 marble articles. No client invoices or payments were created.'
Write-Output ('Stock is supplied by purchase '+$purchase.code+'. Existing TEST records are reused without changing them.')
foreach($product in $products){
    $current=Invoke-RestMethod "$BaseUrl/products/$($product.id)" -Headers $headers
    Write-Output ($current.code+': '+$current.quantity+' m2 available; sale price '+$current.salePrice+' MAD/m2 TTC')
}
