package com.stock.management.invoicing;

import com.stock.management.user.UserRepository;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @ActiveProfiles("test") @Transactional
class StockCategoryTableTest {
    @Autowired CatalogService catalog;
    @Autowired DocumentService documents;
    @Autowired UserRepository users;
    String product,category,client,supplier,user;
    @BeforeEach void setup(){
        user=users.findByUsername("admin").orElseThrow().getId();
        category=catalog.save("categories",null,Map.of("name","Grouped "+UUID.randomUUID())).get("id").toString();
        product=catalog.save("products",null,Map.of("name","Grouped stone","categoryId",category,"lastPurchasePrice",140,"salePrice",550)).get("id").toString();
        client=catalog.save("clients",null,Map.of("name","Grouped client")).get("id").toString();
        supplier=catalog.save("suppliers",null,Map.of("name","Grouped supplier")).get("id").toString();
    }
    Map<String,Object> line(boolean purchase,int length,int width,int pcs){
        return Map.of("productId",product,"length",length,"width",width,"quantity",pcs,"dimensionUnit","CM",purchase?"unitPrice":"unitPriceTtc",140);
    }
    Map<String,Object> save(boolean purchase,List<Map<String,Object>> lines){
        return documents.save(purchase,null,Map.of(purchase?"supplierId":"clientId",purchase?supplier:client,"items",lines),user);
    }
    Map<String,Object> stock(){return catalog.list("products",Map.of("categoryId",category,"stockDetails","true")).getFirst();}
    void number(Map<String,Object> row,String field,String expected){assertThat(new BigDecimal(row.get(field).toString())).as(field).isEqualByComparingTo(expected);}
    @Test void combinesRepeatedDimensionsAndUpdatesCountsAfterSalesEditsAndCancellation(){
        var purchase=save(true,List.of(line(true,200,100,10),line(true,200,100,2),line(true,300,100,5)));
        var sale=save(false,List.of(line(false,200,100,3),line(false,300,100,5)));
        var row=stock();number(row,"stockPieces","9");number(row,"dimensionCount","1");number(row,"quantity","18");
        number(row,"purchaseStockValue","2520");number(row,"saleStockValue","9900");
        assertThat((List<?>)row.get("stockDimensions")).hasSize(1);
        documents.save(false,sale.get("id").toString(),Map.of("items",List.of(line(false,200,100,2))),user);
        row=stock();number(row,"stockPieces","15");number(row,"dimensionCount","2");number(row,"quantity","35");
        documents.save(true,purchase.get("id").toString(),Map.of("status","CANCELLED"),user);
        row=stock();number(row,"stockPieces","-2");number(row,"dimensionCount","0");number(row,"quantity","-4");
        number(row,"purchaseStockValue","-560");
        documents.delete(false,sale.get("id").toString());
        row=stock();number(row,"stockPieces","0");assertThat((List<?>)row.get("stockDimensions")).isEmpty();
    }
    @Test void centimetreAndLegacyMetreFormatsAreGroupedTogether(){
        var metre=new HashMap<String,Object>(line(true,200,100,10));
        metre.put("length",2);metre.put("width",1);metre.put("dimensionUnit","M");
        save(true,List.of(metre,line(true,200,100,2)));
        save(false,List.of(line(false,200,100,3)));
        var row=stock();number(row,"dimensionCount","1");number(row,"stockPieces","9");number(row,"quantity","18");
        var dimension=(Map<String,Object>)((List<?>)row.get("stockDimensions")).getFirst();
        number(dimension,"lengthCm","200");number(dimension,"widthCm","100");number(dimension,"surfaceM2","18");
    }
    @Test void filtersAndLargeMonetaryValuesRemainAccurateAndDetailsAreOptIn(){
        catalog.save("products",product,Map.of("lastPurchasePrice","9999999999.99","salePrice","8888888888.88"));
        save(true,List.of(line(true,200,100,100000)));
        var row=stock();number(row,"purchaseStockValue","1999999999998000");number(row,"saleStockValue","1777777777776000");
        assertThat(catalog.list("products",Map.of("categoryId",category,"search","missing","stockDetails","true"))).isEmpty();
        assertThat(catalog.list("products",Map.of("categoryId",category,"lowStock","true","stockDetails","true"))).isEmpty();
        assertThat(catalog.list("products",Map.of("categoryId",category)).getFirst()).doesNotContainKey("stockDimensions");
    }
}
