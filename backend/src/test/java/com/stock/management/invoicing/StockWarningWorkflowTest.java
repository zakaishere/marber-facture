package com.stock.management.invoicing;

import com.stock.management.user.UserRepository;
import java.math.BigDecimal;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

/** Default policy: stock shortages warn; invoices remain possible. */
@SpringBootTest @ActiveProfiles("test") @Transactional
class StockWarningWorkflowTest {
    @Autowired CatalogService catalog; @Autowired DocumentService documents; @Autowired UserRepository users;
    @Test void emptyAndNegativeStockAllowInvoicesWhileBalancesAndAlertsStayAutomatic(){
        String user=users.findByUsername("admin").orElseThrow().getId();
        String category=catalog.save("categories",null,Map.of("name","Warnings "+UUID.randomUUID())).get("id").toString();
        String product=catalog.save("products",null,Map.of("name","Marbre sans stock","categoryId",category,"salePrice",120)).get("id").toString();
        String client=catalog.save("clients",null,Map.of("name","Client test")).get("id").toString();
        String supplier=catalog.save("suppliers",null,Map.of("name","Fournisseur test")).get("id").toString();
        var line=Map.of("productId",product,"length",100,"width",100,"quantity",3,"dimensionUnit","CM","unitPriceTtc",120);
        var first=documents.save(false,null,Map.of("clientId",client,"items",List.of(line)),user);
        assertThat((BigDecimal)catalog.get("products",product).get("quantity")).isEqualByComparingTo("-3");
        var second=documents.save(false,null,Map.of("clientId",client,"items",List.of(line)),user);
        assertThat((BigDecimal)catalog.get("products",product).get("quantity")).isEqualByComparingTo("-6");
        assertThat(catalog.list("products",Map.of("lowStock","true"))).extracting(row->row.get("id")).contains(product);
        assertThat(((Map<?,?>)documents.dashboard().get("stock")).get("negativeStockCount").toString()).isEqualTo("1");
        documents.save(false,first.get("id").toString(),Map.of("items",List.of(line)),user);
        assertThat((BigDecimal)catalog.get("products",product).get("quantity")).isEqualByComparingTo("-6");
        var purchase=documents.save(true,null,Map.of("supplierId",supplier,"items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",10,"dimensionUnit","CM","unitPrice",100))),user);
        assertThat((BigDecimal)catalog.get("products",product).get("quantity")).isEqualByComparingTo("4");
        documents.delete(true,purchase.get("id").toString());
        assertThat((BigDecimal)catalog.get("products",product).get("quantity")).isEqualByComparingTo("-6");
        documents.delete(false,second.get("id").toString());
        assertThat((BigDecimal)catalog.get("products",product).get("quantity")).isEqualByComparingTo("-3");
    }
}
