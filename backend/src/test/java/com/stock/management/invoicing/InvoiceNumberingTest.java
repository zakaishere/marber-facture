package com.stock.management.invoicing;

import com.stock.management.common.error.BadRequestException;
import com.stock.management.user.UserRepository;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;

@SpringBootTest @ActiveProfiles("test") @Transactional
class InvoiceNumberingTest {
    @Autowired DocumentService documents; @Autowired CatalogService catalog;
    @Autowired UserRepository users; @Autowired JdbcTemplate jdbc;
    String user,client,supplier,product;
    @BeforeEach void setup(){
        user=users.findByUsername("admin").orElseThrow().getId();
        var category=catalog.save("categories",null,Map.of("name","Numbering "+UUID.randomUUID())).get("id");
        product=catalog.save("products",null,Map.of("name","Numbering marble","categoryId",category)).get("id").toString();
        client=catalog.save("clients",null,Map.of("name","Numbering client")).get("id").toString();
        supplier=catalog.save("suppliers",null,Map.of("name","Numbering supplier")).get("id").toString();
    }
    Map<String,Object> create(boolean purchase,String date){
        return documents.save(purchase,null,Map.of("date",date,purchase?"supplierId":"clientId",purchase?supplier:client,
            "items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",1,"dimensionUnit","CM",purchase?"unitPrice":"unitPriceTtc",120))),user);
    }
    String code(Map<String,Object> document){return document.get("code").toString();}
    String id(Map<String,Object> document){return document.get("id").toString();}
    String preview(String date){return code(documents.invoiceNumberPreview(date,null));}
    void counter(String period,int value){jdbc.update("INSERT INTO document_counters(kind,prefix,last_value) VALUES ('FACTURE',?,?)",period,value);}

    @Test void usesSelectedDatesAndResetsEachMonthAndYearWithoutConsumingPreviews(){
        long count=jdbc.queryForObject("SELECT COUNT(*) FROM document_counters",Long.class);
        assertThat(preview("2160-10-05")).isEqualTo("01-10-2160");
        assertThat(preview("2160-10-30")).isEqualTo("01-10-2160");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM document_counters",Long.class)).isEqualTo(count);
        assertThat(code(create(false,"2160-10-05"))).isEqualTo("01-10-2160");
        assertThat(code(create(false,"2160-10-01"))).isEqualTo("02-10-2160");
        assertThat(code(create(false,"2160-11-01"))).isEqualTo("01-11-2160");
        assertThat(code(create(false,"2161-10-01"))).isEqualTo("01-10-2161");
        assertThat(preview("2160-10-31")).isEqualTo("03-10-2160");
        assertThatThrownBy(()->documents.invoiceNumberPreview("",null)).isInstanceOf(BadRequestException.class);
        assertThatThrownBy(()->documents.invoiceNumberPreview("not-a-date",null)).isInstanceOf(BadRequestException.class);
    }
    @Test void previewsAreAdvisoryAndTheSavedResultUsesTheNextActualNumber(){
        assertThat(preview("2162-02-10")).isEqualTo("01-02-2162");
        create(false,"2162-02-20");
        var result=create(false,"2162-02-10");
        assertThat(code(result)).isEqualTo("02-02-2162");
        assertThat(code(documents.get(false,id(result)))).isEqualTo("02-02-2162");
    }
    @Test void legacyCountersAndExistingNumbersAreNeverResetEvenWithALowerModernCounter(){
        counter("6310",43);counter("10-2163",11);
        var legacy=create(false,"2163-10-01");
        assertThat(code(legacy)).isEqualTo("44-10-2163");
        jdbc.update("UPDATE factures SET code=? WHERE id=?","6310079",id(legacy));
        var modern=create(false,"2163-10-01");assertThat(code(modern)).isEqualTo("80-10-2163");
        jdbc.update("UPDATE factures SET code=? WHERE id=?","105-10-2163",id(modern));
        assertThat(preview("2163-10-10")).isEqualTo("106-10-2163");
        assertThat(code(create(false,"2163-10-10"))).isEqualTo("106-10-2163");
        assertThat(code(documents.get(false,id(legacy)))).isEqualTo("6310079");
        assertThat(jdbc.queryForObject("SELECT last_value FROM document_counters WHERE kind='FACTURE' AND prefix='6310'",Integer.class)).isEqualTo(43);
    }
    @Test void legacyCounterAloneIncludesPreviouslyDeletedNumbers(){
        counter("6403",1234);
        assertThat(preview("2164-03-10")).isEqualTo("1235-03-2164");
        assertThat(code(create(false,"2164-03-10"))).isEqualTo("1235-03-2164");
    }
    @Test void continuesAfterNinetyNineAndNeverReusesDeletedModernNumbers(){
        counter("04-2165",99);
        var invoice=create(false,"2165-04-01");assertThat(code(invoice)).isEqualTo("100-04-2165");
        documents.delete(false,id(invoice));
        assertThat(code(create(false,"2165-04-01"))).isEqualTo("101-04-2165");
    }
    @Test void deletingImportedLegacyAndModernInvoicesRetainsTheirNumbersWithoutPriorCounters(){
        var legacy=create(false,"2166-10-01");
        jdbc.update("UPDATE factures SET code=? WHERE id=?","6610007",id(legacy));
        jdbc.update("DELETE FROM document_counters WHERE kind='FACTURE' AND prefix='10-2166'");
        documents.delete(false,id(legacy));
        assertThat(code(create(false,"2166-10-10"))).isEqualTo("08-10-2166");
        var modern=create(false,"2166-11-01");
        jdbc.update("UPDATE factures SET code=? WHERE id=?","120-11-2166",id(modern));
        jdbc.update("DELETE FROM document_counters WHERE kind='FACTURE' AND prefix='11-2166'");
        documents.delete(false,id(modern));
        assertThat(preview("2166-11-01")).isEqualTo("121-11-2166");
    }
    @Test void dateEditsPreserveLegacyAndModernNumbersWithinMonthAndAllocateForNewPeriods(){
        var invoice=create(false,"2167-05-01");
        jdbc.update("UPDATE factures SET code=? WHERE id=?","6705042",id(invoice));
        jdbc.update("DELETE FROM document_counters WHERE kind='FACTURE' AND prefix='05-2167'");
        assertThat(documents.get(false,id(invoice)).get("date").toString()).isEqualTo("2167-05-01");
        assertThat(code(documents.invoiceNumberPreview("2167-05-20",id(invoice)))).isEqualTo("6705042");
        var unchanged=documents.save(false,id(invoice),Map.of("code","IGNORE-ME"),user);
        assertThat(code(unchanged)).isEqualTo("6705042");
        assertThat(code(documents.save(false,id(invoice),Map.of("date","2167-05-31"),user))).isEqualTo("6705042");
        create(false,"2167-06-01");
        documents.payment(false,id(invoice),null,Map.of("amount",10,"method","ESPECE"),false);
        assertThat(code(documents.invoiceNumberPreview("2167-06-10",id(invoice)))).isEqualTo("02-06-2167");
        var moved=documents.save(false,id(invoice),Map.of("date","2167-06-10"),user);
        assertThat(code(moved)).isEqualTo("02-06-2167");
        assertThat(documents.payments(false,id(invoice)).getFirst().get("reference")).isEqualTo(code(moved));
        assertThat(code(documents.save(false,id(invoice),Map.of("date","2167-06-15"),user))).isEqualTo("02-06-2167");
        assertThat(code(documents.save(false,id(invoice),Map.of("date","2167-05-10"),user))).isEqualTo("43-05-2167");
        assertThat(code(documents.save(false,id(invoice),Map.of("date","2168-05-10"),user))).isEqualTo("01-05-2168");
    }
    @Test void movingAnImportedInvoiceRetainsTheOldConsumedModernNumber(){
        var invoice=create(false,"2169-08-01");
        jdbc.update("UPDATE factures SET code='90-08-2169' WHERE id=?",id(invoice));
        jdbc.update("DELETE FROM document_counters WHERE kind='FACTURE' AND prefix='08-2169'");
        documents.save(false,id(invoice),Map.of("date","2169-09-01"),user);
        assertThat(code(create(false,"2169-08-01"))).isEqualTo("91-08-2169");
    }
    @Test void exhaustedCounterRejectsWithoutWrapping(){
        counter("01-2170",Integer.MAX_VALUE);
        assertThatThrownBy(()->create(false,"2170-01-01")).isInstanceOf(BadRequestException.class).hasMessageContaining("épuisée");
    }
    @Test void purchaseNumberingIsUnchangedAndIndependent(){
        assertThat(code(create(true,"2171-03-10"))).isEqualTo("BA-21710310-0001");
        var purchase=create(true,"2171-03-10");assertThat(code(purchase)).isEqualTo("BA-21710310-0002");
        assertThat(code(create(true,"2171-03-11"))).isEqualTo("BA-21710311-0001");
        assertThat(preview("2171-03-10")).isEqualTo("01-03-2171");
        assertThat(code(documents.save(true,id(purchase),Map.of("date","2171-03-11"),user))).isEqualTo("BA-21710311-0002");
    }
}
