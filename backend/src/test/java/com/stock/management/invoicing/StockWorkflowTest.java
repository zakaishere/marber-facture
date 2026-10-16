package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import com.stock.management.user.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest(properties="app.stock.enforce-availability=true") @ActiveProfiles("test") @Transactional
class StockWorkflowTest {
    @Autowired CatalogService catalog;@Autowired DocumentService documents;@Autowired UserRepository users;
    String product,client,supplier,user;
    @BeforeEach void setup(){
        user=users.findByUsername("admin").orElseThrow().getId();
        String category=catalog.save("categories",null,Map.of("name","Stock "+UUID.randomUUID())).get("id").toString();
        product=catalog.save("products",null,Map.of("name","Marbre stock","categoryId",category)).get("id").toString();
        client=catalog.save("clients",null,Map.of("name","Client stock")).get("id").toString();
        supplier=catalog.save("suppliers",null,Map.of("name","Fournisseur stock")).get("id").toString();
    }
    Map<String,Object> line(int pcs,boolean purchase){return Map.of("productId",product,"length",250,"width",80,"dimensionUnit","CM","quantity",pcs,purchase?"unitPrice":"unitPriceTtc",120);}
    Map<String,Object> save(boolean purchase,String id,int pcs){return documents.save(purchase,id,Map.of(purchase?"supplierId":"clientId",purchase?supplier:client,"items",List.of(line(pcs,purchase))),user);}
    String id(Map<String,Object> value){return value.get("id").toString();}
    BigDecimal balance(){return (BigDecimal)catalog.get("products",product).get("quantity");}
    @Test void purchasesAndSalesUseSurfaceTimesPiecesAndEditsNeverDoubleCount(){
        var purchase=save(true,null,10);assertThat(balance()).isEqualByComparingTo("20");
        var invoice=save(false,null,3);assertThat(balance()).isEqualByComparingTo("14");
        save(false,id(invoice),3);assertThat(balance()).isEqualByComparingTo("14");
        save(false,id(invoice),4);assertThat(balance()).isEqualByComparingTo("12");
        save(true,id(purchase),12);assertThat(balance()).isEqualByComparingTo("16");
        documents.delete(false,id(invoice));assertThat(balance()).isEqualByComparingTo("24");
        documents.delete(true,id(purchase));assertThat(balance()).isZero();
    }
    @Test void fractionalDimensionsKeepSixDecimalsAndCancelledPurchasesDoNotAddStock(){
        var fine=new HashMap<String,Object>(line(3,true));fine.put("length",323);fine.put("width",71);
        var purchase=documents.save(true,null,Map.of("supplierId",supplier,"items",List.of(fine)),user);
        assertThat(balance()).isEqualByComparingTo("6.8799");
        documents.save(true,id(purchase),Map.of("status","CANCELLED"),user);assertThat(balance()).isZero();
    }
    @Test void availabilityIsEnforcedAndPaymentsHaveNoEffect(){
        save(true,null,10);var invoice=save(false,null,3);var before=balance();
        documents.payment(false,id(invoice),null,Map.of("amount",50,"method","ESPECE"),false);assertThat(balance()).isEqualByComparingTo(before);
        assertThatThrownBy(()->save(false,null,8)).isInstanceOf(BadRequestException.class).hasMessageContaining("Stock insuffisant");
    }
    @Test void consumedPurchasesCannotBeRemovedAndManualQuantityIsRejected(){
        var purchase=save(true,null,10);save(false,null,3);
        assertThatThrownBy(()->documents.delete(true,id(purchase))).isInstanceOf(BadRequestException.class).hasMessageContaining("Stock insuffisant");
    }
    @Test void automaticThresholdUsesThirtyDaysAndDashboardIncludesEmptyArticles(){
        save(true,null,35);save(false,null,30);
        var p=catalog.get("products",product);
        assertThat((BigDecimal)p.get("quantity")).isEqualByComparingTo("10");
        assertThat((BigDecimal)p.get("alertThreshold")).isEqualByComparingTo("14");
        assertThat(catalog.list("products",Map.of("lowStock","true"))).extracting(row->row.get("id")).contains(product);
        assertThat(((Map<?,?>)documents.dashboard().get("stock")).get("lowStockCount").toString()).isEqualTo("1");
    }
    @Test void stockQuantityCannotBeEditedFromCatalogue(){
        assertThatThrownBy(()->catalog.save("products",product,Map.of("quantity",10))).isInstanceOf(BadRequestException.class).hasMessageContaining("automatiquement");
    }
}
