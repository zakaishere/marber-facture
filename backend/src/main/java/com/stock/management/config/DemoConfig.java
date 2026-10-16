package com.stock.management.config;

import com.stock.management.invoicing.*;
import com.stock.management.user.UserRepository;
import java.time.LocalDate;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.*;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component @Order(10)
public class DemoConfig implements ApplicationRunner {
    private final Store db;private final CatalogService catalog;private final DocumentService docs;private final UserRepository users;
    private final boolean enabled;private final String admin;
    public DemoConfig(Store db,CatalogService catalog,DocumentService docs,UserRepository users,@Value("${app.demo.enabled:true}") boolean enabled,@Value("${app.admin.username}") String admin){this.db=db;this.catalog=catalog;this.docs=docs;this.users=users;this.enabled=enabled;this.admin=admin;}
    @Override @Transactional
    public void run(ApplicationArguments args){
        if(!enabled||!db.query("SELECT name FROM app_metadata WHERE name='demo-v1'").isEmpty())return;
        String user=users.findByUsername(admin).orElseThrow().getId();
        String category=id(catalog.save("categories",null,Map.of("name","Marbre naturel")));
        String a=id(catalog.save("products",null,Map.of("code","MAR-HAL","name","New Halayeb","categoryId",category,"salePrice",200,"lastPurchasePrice",150,"tvaPercent",20)));
        String b=id(catalog.save("products",null,Map.of("code","MAR-CRE","name","Crema Silvia","categoryId",category,"salePrice",140,"lastPurchasePrice",100,"tvaPercent",20)));
        catalog.save("products",null,Map.of("code","MAR-CAR","name","Carrara blanc","categoryId",category,"salePrice",450,"lastPurchasePrice",300,"tvaPercent",20));
        String client=id(catalog.save("clients",null,Map.of("name","Atlas Décoration (démo)","phone","0600000001","address","Casablanca","ice","000000000000001")));
        String other=id(catalog.save("clients",null,Map.of("name","Riad des Pierres (démo)","phone","0600000002","address","Tanger")));
        String supplier=id(catalog.save("suppliers",null,Map.of("name","AZAN (démo)","phone","0600000003","address","Fournisseur de marbre")));
        var purchase=docs.save(true,null,Map.of("supplierId",supplier,"date",LocalDate.now().minusDays(5).toString(),"items",List.of(line(a,323,71,18,150,true,false),line(a,330,71,2,150,true,true),line(b,279,155,16,100,true,true))),user);
        docs.payment(true,id(purchase),null,Map.of("amount",1000,"method","BANK_TRANSFER","note","Acompte de démonstration"),false);
        var unpaid=docs.save(false,null,Map.of("clientId",client,"date",LocalDate.now().minusDays(2).toString(),"items",List.of(line(a,323,71,16,200,false,false),line(a,330,71,2,200,false,true),line(b,279,155,2,140,false,true))),user);
        docs.payment(false,id(unpaid),null,Map.of("amount",2000,"method","VIREMENT","note","Premier règlement"),false);
        var full=docs.save(false,null,Map.of("clientId",other,"items",List.of(line(b,100,100,2,140,false,false))),user);
        docs.payment(false,id(full),null,Map.of("amount",full.get("totalTtc"),"method","ESPECE"),false);
        docs.save(false,null,Map.of("clientId",client,"items",List.of(line(a,200,80,1,200,false,false))),user);
        db.jdbc.update("INSERT INTO app_metadata(name,content) VALUES ('demo-v1','installed')");
    }
    private String id(Map<String,Object> row){return row.get("id").toString();}
    private Map<String,Object> line(String product,int length,int width,int pieces,int price,boolean purchase,boolean subtotal){
        Map<String,Object> line=new LinkedHashMap<>();line.put("productId",product);line.put("length",length);line.put("width",width);line.put("dimensionUnit","CM");line.put("quantity",pieces);line.put(purchase?"unitPrice":"unitPriceTtc",price);line.put("tvaPercent",20);line.put("subtotalAfter",subtotal);return line;
    }
}
