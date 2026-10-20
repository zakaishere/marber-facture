param([Parameter(Mandatory=$true)][string]$SnapshotFile,[switch]$PrepareOnly,[string]$OutputDirectory=(Join-Path $PSScriptRoot 'backups'))
$ErrorActionPreference='Stop'
$snapshotPath=(Resolve-Path -LiteralPath $SnapshotFile).Path
if(Test-Path -LiteralPath "$snapshotPath.sha256"){
    $expected=(Get-Content -LiteralPath "$snapshotPath.sha256" -Raw).Trim()
    if((Get-FileHash -LiteralPath $snapshotPath -Algorithm SHA256).Hash -ne $expected){throw 'Export checksum does not match. No import attempted.'}
}
$snapshot=Get-Content -LiteralPath $snapshotPath -Raw|ConvertFrom-Json
if($snapshot.format -ne 'marble-application-export-v1'){throw 'Unsupported application export.'}
foreach($resource in @('categories','clients','suppliers','products','factures','bon-achat','payments')){foreach($row in $snapshot.$resource){if(-not $row.id -or $row -is [Array]){throw "Invalid record in $resource. Create a fresh export."}}}
$sql=[System.Collections.Generic.List[string]]::new()
function Sql-Literal($Value){if($null -eq $Value){return 'NULL'};if($Value -is [DateTime]){return "'"+$Value.ToString('yyyy-MM-ddTHH:mm:ss.fffffff',[Globalization.CultureInfo]::InvariantCulture)+"'"};if($Value -is [ValueType] -and $Value -is [IFormattable] -and $Value -isnot [bool]){return "'"+$Value.ToString($null,[Globalization.CultureInfo]::InvariantCulture)+"'"};if($Value -is [bool]){if($Value){return 'TRUE'}else{return 'FALSE'}};return "'"+$Value.ToString().Replace("'","''")+"'"}
function Add-Row([string]$Table,[System.Collections.IDictionary]$Values){
    $encoded=@(foreach($value in $Values.Values){Sql-Literal $value}) -join ','
    $sql.Add('INSERT INTO '+$Table+' ('+($Values.Keys -join ',')+') VALUES ('+$encoded+');')
}
function Base-Row($Row){return [ordered]@{id=$Row.id;created_at=$Row.createdAt;updated_at=$Row.updatedAt}}
$sql.Add('BEGIN;')
$sql.Add('LOCK TABLE categories,clients,suppliers,products,factures,bon_achats,payments IN ACCESS EXCLUSIVE MODE;')
$sql.Add('DO $$ BEGIN IF EXISTS(SELECT 1 FROM clients) OR EXISTS(SELECT 1 FROM suppliers) OR EXISTS(SELECT 1 FROM products) OR EXISTS(SELECT 1 FROM categories) OR EXISTS(SELECT 1 FROM factures) OR EXISTS(SELECT 1 FROM bon_achats) THEN RAISE EXCEPTION ''Import requires an empty business database; existing records have been left unchanged''; END IF; IF (SELECT COUNT(*) FROM users)<>1 THEN RAISE EXCEPTION ''Import requires exactly one configured administrator''; END IF; END $$;')
foreach($row in $snapshot.categories){$values=Base-Row $row;$values.name=$row.name;Add-Row 'categories' $values}
foreach($resource in @('clients','suppliers')){foreach($row in $snapshot.$resource){$values=Base-Row $row;$values.name=$row.name;$values.phone=$row.phone;$values.address=$row.address;if($resource -eq 'clients'){$values.ice=$row.ice};Add-Row $resource $values}}
foreach($row in $snapshot.products){$values=Base-Row $row;foreach($mapping in @(@('code','code'),@('name','name'),@('category_id','categoryId'),@('sale_price','salePrice'),@('last_purchase_price','lastPurchasePrice'),@('tva_rate','tvaRate'),@('quantity','quantity'),@('min_stock','minStock'))){$values[$mapping[0]]=$row.($mapping[1])};Add-Row 'products' $values}
foreach($resource in @('factures','bon-achat')){
    $purchase=$resource -eq 'bon-achat';$table=if($purchase){'bon_achats'}else{'factures'};$lineTable=if($purchase){'bon_achat_lines'}else{'facture_lines'};$party=if($purchase){'supplier'}else{'client'};$fk=if($purchase){'bon_achat_id'}else{'facture_id'}
    foreach($row in $snapshot.$resource){
        $values=Base-Row $row;$values.code=$row.code;$values.date=$row.date;$values["${party}_id"]=$row.("${party}Id");$values.status=$row.status;$values.payment_method=$row.paymentMethod;$values.total_ht=$row.totalHt;$values.total_tva=$row.totalTva
        if(-not $purchase){$values.notes=$row.notes}
        $values[$(if($purchase){'total_amount'}else{'total_ttc'})]=$(if($purchase){$row.totalAmount}else{$row.totalTtc})
        $values["${party}_snapshot"]=$row.$party|ConvertTo-Json -Depth 20 -Compress;$values.company_snapshot=$row.company|ConvertTo-Json -Depth 20 -Compress;Add-Row $table $values
        $position=0
        foreach($line in $row.items){
            $values=Base-Row $line;$values[$fk]=$row.id;$values.product_id=$line.productId;$values.product_name=$line.product.name;$values.product_code=$line.product.code
            foreach($mapping in @(@('length','length'),@('width','width'),@('dimension_unit','dimensionUnit'),@('quantity','quantity'),@('surface','surface'),@('tva_rate','tvaRate'),@('line_total_ht','lineTotalHt'),@('line_total_tva','lineTotalTva'),@('subtotal_after','subtotalAfter'))){$values[$mapping[0]]=$line.($mapping[1])}
            $values.position=$position++;$values[$(if($purchase){'unit_price'}else{'unit_price_ttc'})]=$(if($purchase){$line.unitPrice}else{$line.unitPriceTtc});$values[$(if($purchase){'line_total'}else{'line_total_ttc'})]=$(if($purchase){$line.lineTotal}else{$line.lineTotalTtc});Add-Row $lineTable $values
        }
    }
}
foreach($row in $snapshot.payments){$values=Base-Row $row;foreach($mapping in @(@('facture_id','factureId'),@('bon_achat_id','bonAchatId'),@('amount','amount'),@('method','method'),@('date','date'),@('note','note'),@('reference','reference'))){$values[$mapping[0]]=$row.($mapping[1])};Add-Row 'payments' $values}
$company=$snapshot.profile.company
$assignments=@(foreach($field in @('name','activity','address','phone_fix','phone_mobile','phone_whatsapp','email','rc','if','patente','cnss','ice')){"company_$field="+(Sql-Literal $company.$field)}) -join ','
$sql.Add("UPDATE users SET $assignments;")
$sql.Add('COMMIT;')
$folder=$OutputDirectory;New-Item -ItemType Directory -Force -Path $folder|Out-Null
$name='preview-import-'+[Guid]::NewGuid().ToString('N')+'.sql';$path=Join-Path $folder $name
$sql|Set-Content -LiteralPath $path -Encoding utf8
if($PrepareOnly){Write-Output "Prepared import SQL without changing any database: $path";return}
Push-Location $PSScriptRoot
try{
    & docker compose cp $path "db:/tmp/$name";if($LASTEXITCODE -ne 0){throw 'Could not copy import file. Preview data has not been changed.'}
    & docker compose exec -T db psql -U marble -d marble_invoicing -v ON_ERROR_STOP=1 -f "/tmp/$name"
    if($LASTEXITCODE -ne 0){throw 'Import failed and its transaction was rolled back.'}
    Write-Output 'Imported business records and company details. Existing document IDs, numbers, snapshots, dimensions and payments are preserved. The live administrator credentials are unchanged.'
}finally{& docker compose exec -T db rm -f -- "/tmp/$name";Pop-Location}

