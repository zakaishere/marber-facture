package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import java.math.BigDecimal;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CatalogService {
    private final Store db;
    public CatalogService(Store db) {this.db=db;}
    public String table(String resource) {
        return switch(resource) {case "clients","suppliers","products","categories"->resource; default->throw new BadRequestException("Ressource inconnue");};
    }
    public List<Map<String,Object>> list(String resource,Map<String,String> q) {
        String table=table(resource); List<Object> args=new ArrayList<>(); String sql=table.equals("products")?"SELECT products.*,s.quantity,s.purchased_surface,s.sold_surface,s.sold_30_days,s.alert_threshold,c.name AS category_name FROM products JOIN categories c ON c.id=products.category_id JOIN product_stock s ON s.product_id=products.id WHERE 1=1":"SELECT * FROM "+table+" WHERE 1=1";
        if(!Input.text(q.get("search")).isEmpty()) {
            String search="%"+q.get("search").toLowerCase(Locale.ROOT)+"%";
            sql+=table.equals("products")?" AND (LOWER(products.name) LIKE ? OR LOWER(products.code) LIKE ?)":" AND LOWER(name) LIKE ?";args.add(search);if(table.equals("products"))args.add(search);
        }
        if(table.equals("products")&&!Input.text(q.get("categoryId")).isEmpty()) { sql+=" AND category_id=?"; args.add(q.get("categoryId")); }
        if(table.equals("products")&&"true".equals(q.get("lowStock")))sql+=" AND s.quantity<=s.alert_threshold";
        sql+=table.equals("products")?" ORDER BY products.name,products.id LIMIT ? OFFSET ?":" ORDER BY name,id LIMIT ? OFFSET ?"; args.add(Input.limit(q)); args.add((long)(Input.page(q)-1)*Input.limit(q));
        var rows=db.query(sql,args.toArray()).stream().map(row->enrich(table,row)).toList();
        if(table.equals("products")&&"true".equals(q.get("stockDetails")))addStockDetails(rows);
        return rows;
    }
    public Map<String,Object> get(String resource,String id) {
        var row=db.get(table(resource),id);
        if(resource.equals("products"))row.putAll(db.query("SELECT quantity,purchased_surface,sold_surface,sold_30_days,alert_threshold FROM product_stock WHERE product_id=?",id).getFirst());
        return enrich(table(resource),row);
    }
    private Map<String,Object> enrich(String table,Map<String,Object> row) {
        if(table.equals("products")) row.put("category",row.containsKey("categoryName")?Map.of("id",row.get("categoryId"),"name",row.remove("categoryName")):db.get("categories",row.get("categoryId").toString())); return row;
    }
    /** Batch ledger query: no per-article queries, and no changes to saved stock or documents. */
    private void addStockDetails(List<Map<String,Object>> products) {
        if(products.isEmpty())return;
        String placeholders=String.join(",",Collections.nCopies(products.size(),"?"));
        String sql="""
            SELECT product_id,length_cm,width_cm,SUM(pieces) AS pieces,SUM(surface_m2) AS surface_m2
            FROM (
              SELECT l.product_id,
                CASE WHEN l.dimension_unit='M' THEN l.length*100 ELSE l.length END AS length_cm,
                CASE WHEN l.dimension_unit='M' THEN l.width*100 ELSE l.width END AS width_cm,
                CAST(l.quantity AS BIGINT) AS pieces,l.surface*l.quantity AS surface_m2
              FROM bon_achat_lines l JOIN bon_achats b ON b.id=l.bon_achat_id
              WHERE b.status<>'CANCELLED' AND l.product_id IN (%s)
              UNION ALL
              SELECT l.product_id,
                CASE WHEN l.dimension_unit='M' THEN l.length*100 ELSE l.length END,
                CASE WHEN l.dimension_unit='M' THEN l.width*100 ELSE l.width END,
                -CAST(l.quantity AS BIGINT),-l.surface*l.quantity
              FROM facture_lines l JOIN factures f ON f.id=l.facture_id
              WHERE l.product_id IN (%s)
            ) movements
            GROUP BY product_id,length_cm,width_cm
            HAVING SUM(pieces)<>0 OR SUM(surface_m2)<>0
            ORDER BY product_id,length_cm,width_cm
            """.formatted(placeholders,placeholders);
        List<Object> args=new ArrayList<>();
        for(int copy=0;copy<2;copy++)for(var product:products)args.add(product.get("id"));
        Map<String,List<Map<String,Object>>> dimensions=new HashMap<>();
        for(var row:db.query(sql,args.toArray()))dimensions.computeIfAbsent(row.get("productId").toString(),key->new ArrayList<>()).add(row);
        for(var product:products){
            var rows=dimensions.getOrDefault(product.get("id").toString(),List.of());
            product.put("stockDimensions",rows);
            product.put("dimensionCount",rows.stream().filter(row->new BigDecimal(row.get("pieces").toString()).signum()>0).count());
            product.put("stockPieces",rows.stream().map(row->new BigDecimal(row.get("pieces").toString())).reduce(BigDecimal.ZERO,BigDecimal::add));
            BigDecimal surface=new BigDecimal(product.get("quantity").toString());
            product.put("purchaseStockValue",LineCalculator.money(surface.multiply(new BigDecimal(product.get("lastPurchasePrice").toString()))).toPlainString());
            product.put("saleStockValue",LineCalculator.money(surface.multiply(new BigDecimal(product.get("salePrice").toString()))).toPlainString());
        }
    }
    @Transactional
    public Map<String,Object> save(String resource,String id,Map<String,Object> body) {
        String table=table(resource); Map<String,Object> old=id==null?new LinkedHashMap<>():db.get(table,id);
        Map<String,Object> merged=new LinkedHashMap<>(old); merged.putAll(body);
        Map<String,Object> data=new LinkedHashMap<>(); data.put("name",Input.required(merged,"name",200));
        if(table.equals("clients")||table.equals("suppliers")) {
            data.put("phone",Input.optional(merged.get("phone"),30)); data.put("address",Input.optional(merged.get("address"),2000));
            if(table.equals("clients")) data.put("ice",Input.optional(merged.get("ice"),15));
        }
        if(table.equals("products")) {
            String code=Input.text(merged.get("code")); if(code.isEmpty()) code="ART-"+db.id().substring(0,8).toUpperCase(Locale.ROOT);
            if(code.length()>50) throw new BadRequestException("Référence trop longue"); data.put("code",code);
            String category=Input.required(merged,"categoryId",25); db.get("categories",category); data.put("category_id",category);
            if(body.containsKey("quantity"))throw new BadRequestException("Le stock est calculé automatiquement depuis les bons d'achat et les factures.");
            for(String field:List.of("salePrice","lastPurchasePrice","minStock")) {
                String column=switch(field){case "salePrice"->"sale_price";case "lastPurchasePrice"->"last_purchase_price";case "minStock"->"min_stock";default->field;};
                data.put(column,Input.nonnegative(merged.getOrDefault(field,0),field));
            }
            if(body.get("tvaPercent")!=null&&Input.decimal(body.get("tvaPercent"),"TVA").compareTo(new BigDecimal("20"))!=0)throw new BadRequestException("La TVA est fixée à 20 %");
            if(body.get("tvaRate")!=null&&Input.decimal(body.get("tvaRate"),"TVA").compareTo(new BigDecimal("0.20"))!=0)throw new BadRequestException("La TVA est fixée à 20 %");
            data.put("tva_rate",new BigDecimal("0.20"));
        }
        if(id==null) id=db.insert(table,data); else db.update(table,id,data); return get(table,id);
    }
    @Transactional
    public void delete(String resource,String id) {String table=table(resource); db.get(table,id); db.jdbc.update("DELETE FROM "+table+" WHERE id=?",id);}
    public Map<String,Object> summary() {
        return db.query("SELECT COUNT(*) AS total_products,COALESCE(SUM(GREATEST(quantity,0)),0) AS total_quantity,COALESCE(SUM(quantity),0) AS net_quantity,COALESCE(SUM(CASE WHEN quantity<=alert_threshold THEN 1 ELSE 0 END),0) AS low_stock_count,COALESCE(SUM(CASE WHEN quantity<0 THEN 1 ELSE 0 END),0) AS negative_stock_count FROM product_stock").getFirst();
    }
}
