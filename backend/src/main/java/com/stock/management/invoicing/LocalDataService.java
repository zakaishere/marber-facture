package com.stock.management.invoicing;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.stock.management.common.error.BadRequestException;
import java.math.BigDecimal;
import java.nio.file.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Local file preservation; imports never replace an existing business database. */
@Service
public class LocalDataService {
    private final Store db;private final ObjectMapper json;private final Path backupDirectory;
    public LocalDataService(Store db,ObjectMapper json,@Value("${app.local.backup-directory:./data/backups}") String directory){this.db=db;this.json=json;this.backupDirectory=Path.of(directory).toAbsolutePath().normalize();}
    private void requireLocal(){
        try(var connection=db.jdbc.getDataSource().getConnection()){
            if(!connection.getMetaData().getURL().startsWith("jdbc:h2:file:"))throw new BadRequestException("Disponible uniquement avec la base locale permanente.");
        }catch(SQLException ex){throw new IllegalStateException("Local database unavailable",ex);}
    }
    public Path backup(){
        requireLocal();
        try{
            Files.createDirectories(backupDirectory);
            Path file=backupDirectory.resolve("marble-local-"+LocalDate.now()+"-"+UUID.randomUUID()+".zip");
            db.jdbc.execute("BACKUP TO '"+file.toString().replace("'","''")+"'");return file;
        }catch(java.io.IOException ex){throw new IllegalStateException("Backup could not be created",ex);}
    }
    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> rows(Map<String,Object> source,String name){
        if(!(source.get(name) instanceof List<?> list))throw new BadRequestException("Export invalide: "+name);
        var result=new ArrayList<Map<String,Object>>();
        for(Object value:list){if(!(value instanceof Map<?,?> row)||!Input.text(row.get("id")).matches("[A-Za-z0-9_-]{1,25}"))throw new BadRequestException("Enregistrement invalide: "+name);result.add((Map<String,Object>)row);}return result;
    }
    private Map<String,Object> record(Map<String,Object> source,String... fields){
        var values=new LinkedHashMap<String,Object>();
        for(String field:fields){String[] pair=field.split(":");Object value=source.get(pair.length==2?pair[1]:pair[0]);
            if(value!=null&&(pair[0].equals("created_at")||pair[0].equals("updated_at")||pair[0].equals("date")&&value.toString().length()>10))value=Timestamp.valueOf(java.time.LocalDateTime.parse(value.toString().replace(' ','T').replace("Z","")));
            else if(value!=null&&pair[0].equals("date"))value=java.sql.Date.valueOf(value.toString());values.put(pair[0],value);
        }return values;
    }
    private String snapshot(Object value){try{return json.writeValueAsString(value);}catch(Exception ex){throw new BadRequestException("Instantané invalide");}}
    @Transactional
    public Map<String,Object> importPreview(Map<String,Object> source,String userId){
        requireLocal();if(!"marble-application-export-v1".equals(source.get("format")))throw new BadRequestException("Format inconnu");
        db.query("SELECT kind FROM document_sequences ORDER BY kind FOR UPDATE");
        for(String table:List.of("categories","clients","suppliers","products","factures","bon_achats","payments"))if(db.jdbc.queryForObject("SELECT COUNT(*) FROM "+table,Long.class)>0)throw new BadRequestException("L'import nécessite une base métier vide. Aucune donnée existante n'a été remplacée.");
        for(String table:List.of("categories","clients","suppliers"))for(var row:rows(source,table)){
            var values=record(row,"id","name","created_at:createdAt","updated_at:updatedAt");if(!table.equals("categories")){values.putAll(record(row,"phone","address"));if(table.equals("clients"))values.put("ice",row.get("ice"));}db.insert(table,values);
        }
        for(var row:rows(source,"products"))db.insert("products",record(row,"id","name","code","category_id:categoryId","sale_price:salePrice","last_purchase_price:lastPurchasePrice","tva_rate:tvaRate","quantity","min_stock:minStock","created_at:createdAt","updated_at:updatedAt"));
        int documents=0,lineCount=0;
        for(boolean purchase:List.of(false,true)){
            String resource=purchase?"bon-achat":"factures",table=purchase?"bon_achats":"factures",party=purchase?"supplier":"client",fk=purchase?"bon_achat_id":"facture_id";
            for(var row:rows(source,resource)){
                var values=record(row,"id","code","date","status","payment_method:paymentMethod","total_ht:totalHt","total_tva:totalTva",purchase?"total_amount:totalAmount":"total_ttc:totalTtc","created_at:createdAt","updated_at:updatedAt");
                if(!purchase)values.put("notes",Input.optional(row.get("notes"),4000));
                values.put(party+"_id",row.get(party+"Id"));values.put(party+"_snapshot",snapshot(row.get(party)));values.put("company_snapshot",snapshot(row.get("company")));db.insert(table,values);documents++;
                int position=0;BigDecimal total=BigDecimal.ZERO;
                for(var line:rows(row,"items")){
                    var item=record(line,"id","product_id:productId","length","width","dimension_unit:dimensionUnit","quantity","surface","tva_rate:tvaRate","line_total_ht:lineTotalHt","line_total_tva:lineTotalTva","subtotal_after:subtotalAfter","created_at:createdAt","updated_at:updatedAt",purchase?"unit_price:unitPrice":"unit_price_ttc:unitPriceTtc",purchase?"line_total:lineTotal":"line_total_ttc:lineTotalTtc");
                    if(!(line.get("product") instanceof Map<?,?> product))throw new BadRequestException("Article manquant");item.put("product_name",product.get("name"));item.put("product_code",product.get("code"));item.put(fk,row.get("id"));item.put("position",position++);db.insert(purchase?"bon_achat_lines":"facture_lines",item);lineCount++;total=total.add(Input.decimal(line.get(purchase?"lineTotal":"lineTotalTtc"),"Ligne"));
                }
                if(position==0||total.compareTo(Input.decimal(row.get(purchase?"totalAmount":"totalTtc"),"Total"))!=0)throw new BadRequestException("Lignes incohérentes avec le total");
            }
        }
        var payments=rows(source,"payments");for(var row:payments)db.insert("payments",record(row,"id","facture_id:factureId","bon_achat_id:bonAchatId","amount","method","date","note","reference","created_at:createdAt","updated_at:updatedAt"));
        for(boolean purchase:List.of(false,true))for(var row:rows(source,purchase?"bon-achat":"factures")){
            BigDecimal paid=db.jdbc.queryForObject("SELECT COALESCE(SUM(amount),0) FROM payments WHERE "+(purchase?"bon_achat_id":"facture_id")+"=?",BigDecimal.class,row.get("id"));if(paid.compareTo(Input.decimal(row.get("paidAmount"),"Paiements"))!=0||paid.compareTo(Input.decimal(row.get(purchase?"totalAmount":"totalTtc"),"Total"))>0)throw new BadRequestException("Paiements incohérents");
        }
        if(source.get("profile") instanceof Map<?,?> profile&&profile.get("company") instanceof Map<?,?> company){var values=new LinkedHashMap<String,Object>();for(String field:List.of("name","activity","address","phone_fix","phone_mobile","email","rc","if","patente","cnss","ice"))values.put("company_"+field,company.get(field));db.update("users",userId,values);}
        return Map.of("documents",documents,"lines",lineCount,"payments",payments.size(),"message","Données importées");
    }
}
