package com.stock.management.invoicing;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.*;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// These fixtures isolate invoicing maths; StockWorkflowTest checks real stock availability separately.
@SpringBootTest(properties="app.stock.enforce-availability=false") @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class WorkflowTest {
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired com.stock.management.config.SeedConfig seed;
    String token,client,supplier,product,second;
    @BeforeEach void setup()throws Exception{
        token=call("POST","/auth/login",Map.of("username","admin","password","marble123"),200).get("token").asText();
        String category=call("POST","/categories",Map.of("name","Marbre "+UUID.randomUUID()),201).get("id").asText();
        product=call("POST","/products",Map.of("name","New Halayeb","categoryId",category,"salePrice",200,"tvaPercent",20),201).get("id").asText();
        second=call("POST","/products",Map.of("name","Crema Silvia","categoryId",category,"salePrice",140,"tvaPercent",20),201).get("id").asText();
        client=call("POST","/clients",Map.of("name","Client initial","address","Casablanca"),201).get("id").asText();
        supplier=call("POST","/suppliers",Map.of("name","AZAN"),201).get("id").asText();
    }
    JsonNode call(String method,String url,Object body,int expected)throws Exception{
        var req=switch(method){case "POST"->post(url);case "PUT"->put(url);case "PATCH"->patch(url);case "DELETE"->delete(url);default->get(url);};
        if(token!=null)req.header("Authorization","Bearer "+token);
        if(body!=null)req.contentType("application/json").content(json.writeValueAsString(body));
        String result=mvc.perform(req).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return result.isBlank()?json.nullNode():json.readTree(result);
    }
    Map<String,Object> line(String product,int length,int width,int pcs,int price,boolean purchase,boolean subtotal){
        return Map.of("productId",product,"length",length,"width",width,"quantity",pcs,"dimensionUnit","CM",purchase?"unitPrice":"unitPriceTtc",price,"tvaPercent",20,"subtotalAfter",subtotal);
    }
    JsonNode invoice(Object... entries)throws Exception{return call("POST","/factures",Map.of("clientId",client,"items",Arrays.asList(entries)),201);}
    @Test void dedicatedNotesUpdateWorksOnPaidInvoicesWithoutTouchingLinesPaymentsOrStock()throws Exception{
        var first=invoice(line(product,100,100,1,120,false,false));String url="/factures/"+first.get("id").asText();
        call("POST",url+"/payments",Map.of("amount",120,"method","ESPECE"),201);
        var before=call("GET",url,null,200);var stock=call("GET","/products/"+product,null,200).get("quantity");
        assertThat(call("PATCH",url+"/notes",Map.of("notes","Note sur une facture déjà payée"),200).get("notes").asText()).isEqualTo("Note sur une facture déjà payée");
        var after=call("GET",url,null,200);
        for(String field:List.of("code","status","items","totalHt","totalTva","totalTtc","paidAmount","remainingAmount"))assertThat(after.get(field)).isEqualTo(before.get(field));
        assertThat(call("GET","/products/"+product,null,200).get("quantity")).isEqualTo(stock);
        call("PATCH",url+"/notes",Map.of(),400);call("PATCH",url+"/notes",Map.of("notes","x".repeat(4001)),400);
        assertThat(call("PATCH",url+"/notes",Map.of("notes",""),200).get("notes").isNull()).isTrue();
        assertThat(call("GET",url,null,200).get("notes").isNull()).isTrue();
        token=null;call("PATCH",url+"/notes",Map.of("notes","Interdit"),401);
    }
    @Test void internalInvoiceNotesPersistAndCanBeUpdatedWithoutChangingTotals()throws Exception{
        var f=call("POST","/factures",Map.of("clientId",client,"notes","Appeler le client avant livraison.\nNote privée <interne>.","items",List.of(line(product,100,100,1,120,false,false))),201);
        String url="/factures/"+f.get("id").asText();
        assertThat(call("GET",url,null,200).get("notes").asText()).isEqualTo("Appeler le client avant livraison.\nNote privée <interne>.");
        var edited=call("PUT",url,Map.of("notes","Suivi confirmé"),200);
        assertThat(edited.get("notes").asText()).isEqualTo("Suivi confirmé");
        assertThat(edited.get("totalTtc").decimalValue()).isEqualByComparingTo("120");
        assertThat(edited.get("code").asText()).isEqualTo(f.get("code").asText());
        call("PUT",url,Map.of("notes","x".repeat(4001)),400);
        assertThat(call("PUT",url,Map.of("notes",""),200).get("notes").isNull()).isTrue();
    }
    @Test void largePurchasePricesRoundTripAndOversizedInputsReturnSpecificErrors()throws Exception{
        var item=new HashMap<String,Object>(line(product,100,100,1,200,true,false));item.put("unitPrice",new java.math.BigDecimal("9999999999.99"));
        var body=Map.of("supplierId",supplier,"items",List.of(item));
        var purchase=call("POST","/bon-achat",body,201);
        assertThat(purchase.get("totalAmount").decimalValue()).isEqualByComparingTo("9999999999.99");
        assertThat(call("GET","/bon-achat/"+purchase.get("id").asText(),null,200).at("/items/0/unitPrice").decimalValue()).isEqualByComparingTo("9999999999.99");
        item.put("unitPrice",new java.math.BigDecimal("10000000000"));
        assertThat(call("POST","/bon-achat",body,400).get("message").asText()).contains("maximum 9 999 999 999,99 MAD");
        item.put("unitPrice",new java.math.BigDecimal("120.123"));
        assertThat(call("POST","/bon-achat",body,400).get("message").asText()).contains("deux décimales");
        item.put("unitPrice",120);item.put("length",100001);
        assertThat(call("POST","/bon-achat",body,400).get("message").asText()).contains("Longueur");
        item.put("length",100);item.put("width",100);item.put("unitPrice",new java.math.BigDecimal("9999999999.99"));item.put("quantity",101);
        assertThat(call("POST","/bon-achat",body,400).get("message").asText()).contains("Montant de ligne");
    }
    @Test void dashboardMonthlySalesUseInvoiceDatesAndPaymentDatesWithoutDuplicatingTotals()throws Exception{
        var month=java.time.YearMonth.from(java.time.LocalDate.now(java.time.ZoneId.of("Africa/Casablanca")));
        var first=call("POST","/factures",Map.of("clientId",client,"date",month.atDay(1).toString(),"items",List.of(line(product,100,100,1,200,false,false),line(second,100,100,1,100,false,false))),201);
        call("POST","/factures",Map.of("clientId",client,"date",month.atDay(1).toString(),"items",List.of(line(product,100,100,1,50,false,false))),201);
        call("POST","/factures",Map.of("clientId",client,"date",month.minusMonths(12).atDay(1).toString(),"items",List.of(line(product,100,100,1,70,false,false))),201);
        String payments="/factures/"+first.get("id").asText()+"/payments";
        call("POST",payments,Map.of("amount",40,"date",month.minusMonths(1).atDay(1).toString()),201);
        call("POST",payments,Map.of("amount",60,"date",month.atDay(1).toString()),201);
        var dashboard=call("GET","/dashboard",null,200);
        assertThat(dashboard.get("monthly").size()).isEqualTo(12);
        assertThat(dashboard.at("/monthly/0/month").asText()).isEqualTo(month.minusMonths(11).toString());
        assertThat(dashboard.at("/monthly/0/sales").decimalValue()).isEqualByComparingTo("0");
        assertThat(dashboard.at("/currentMonth/sales").decimalValue()).isEqualByComparingTo("350");
        assertThat(dashboard.at("/currentMonth/paid").decimalValue()).isEqualByComparingTo("60");
        assertThat(dashboard.at("/currentMonth/invoiceCount").asInt()).isEqualTo(2);
        assertThat(dashboard.at("/currentMonth/activeClients").asInt()).isEqualTo(1);
        assertThat(dashboard.at("/previousMonth/paid").decimalValue()).isEqualByComparingTo("40");
        assertThat(dashboard.get("sales").decimalValue()).isEqualByComparingTo("420");
    }
    @Test void screenshotDimensionsAndSubtotalsSurviveRoundTrip()throws Exception{
        var f=invoice(line(product,323,71,16,200,false,false),line(second,100,100,2,140,false,true),line(product,200,80,1,200,false,false));
        var first=f.at("/items/0");assertThat(first.get("surface").decimalValue()).isEqualByComparingTo("2.293300");
        assertThat(first.get("totalSurface").decimalValue()).isEqualByComparingTo("36.692800");
        assertThat(first.get("lineTotalTtc").decimalValue()).isEqualByComparingTo("7338.56");
        assertThat(f.at("/items/1/subtotalAfter").asBoolean()).isTrue();
        var fetched=call("GET","/factures/"+f.get("id").asText(),null,200);
        assertThat(fetched.at("/items/1/subtotalAfter").asBoolean()).isTrue();
        assertThat(fetched.get("totalTtc").decimalValue()).isEqualByComparingTo("7938.56");
        assertThat(call("GET","/products/"+product,null,200).get("quantity").decimalValue()).isEqualByComparingTo("-38.2928");
    }
    @Test void largeInvoiceCanBePaidInInstallmentsDownToTheLastCent()throws Exception{
        var item=new HashMap<String,Object>(line(product,100,100,100,200,false,false));item.put("unitPriceTtc",new java.math.BigDecimal("9999999999.99"));
        var invoice=invoice(item);String url="/factures/"+invoice.get("id").asText();
        assertThat(invoice.get("totalTtc").decimalValue()).isEqualByComparingTo("999999999999.00");
        var first=call("POST",url+"/payments",Map.of("amount","500000000000.01","method","VIREMENT","date","2026-10-01","note","Premier versement"),201);
        String firstId=first.at("/payment/id").asText();
        assertThat(first.at("/facture/paymentStatus").asText()).isEqualTo("PARTIAL");
        call("POST",url+"/payments",Map.of("amount","499999999998.98","method","CHEQUE","date","2026-10-02"),201);
        assertThat(call("GET",url,null,200).get("remainingAmount").decimalValue()).isEqualByComparingTo("0.01");
        call("POST",url+"/payments",Map.of("amount","0.02"),400);
        for(String invalid:List.of("0","-1","0.001","1000000000000.00"))call("POST",url+"/payments",Map.of("amount",invalid),400);
        var settled=call("POST",url+"/payments",Map.of("amount","0.01","date","2026-10-03"),201);
        assertThat(settled.at("/facture/paymentStatus").asText()).isEqualTo("PAID");
        assertThat(settled.at("/facture/paidAmount").decimalValue()).isEqualByComparingTo("999999999999.00");
        assertThat(call("GET",url+"/payments",null,200).size()).isEqualTo(3);
        var corrected=call("PUT",url+"/payments/"+firstId,Map.of("amount","500000000000.00"),200);
        assertThat(corrected.at("/facture/remainingAmount").decimalValue()).isEqualByComparingTo("0.01");
        assertThat(corrected.at("/facture/paymentStatus").asText()).isEqualTo("PARTIAL");
        call("POST",url+"/payments",Map.of("amount","0.01"),201);
        var finalInvoice=call("GET",url,null,200);
        assertThat(finalInvoice.get("remainingAmount").decimalValue()).isEqualByComparingTo("0");
        assertThat(finalInvoice.get("items")).isEqualTo(invoice.get("items"));
        assertThat(finalInvoice.get("code")).isEqualTo(invoice.get("code"));
    }
    @Test void paymentsProtectTotalsAndDeleteAndCanBeCorrected()throws Exception{
        var f=invoice(line(product,100,100,1,200,false,false));String url="/factures/"+f.get("id").asText();
        var paid=call("POST",url+"/payments",Map.of("amount",50,"method","ESPECE"),201);
        assertThat(paid.at("/facture/remainingAmount").decimalValue()).isEqualByComparingTo("150");
        assertThat(paid.at("/facture/paymentStatus").asText()).isEqualTo("PARTIAL");
        call("POST",url+"/payments",Map.of("amount",151,"method","ESPECE"),400);
        call("PUT",url,Map.of("items",List.of(line(product,10,10,1,200,false,false))),400);
        assertThat(call("GET",url,null,200).get("totalTtc").decimalValue()).isEqualByComparingTo("200");
        call("DELETE",url,null,409);
        String payment=paid.at("/payment/id").asText();
        var changed=call("PUT",url+"/payments/"+payment,Map.of("amount",200),200);
        assertThat(changed.at("/facture/paymentStatus").asText()).isEqualTo("PAID");
        call("DELETE",url+"/payments/"+payment,null,200);
        assertThat(call("GET",url,null,200).get("remainingAmount").decimalValue()).isEqualByComparingTo("200");
        call("DELETE",url,null,204);
    }
    @Test void snapshotNamesAndRateAreStableAfterCatalogEdits()throws Exception{
        var f=invoice(line(product,100,100,1,200,false,false));String url="/factures/"+f.get("id").asText();
        call("PUT","/clients/"+client,Map.of("name","Nouveau nom"),200);
        call("PUT","/products/"+product,Map.of("name","Nouveau marbre"),200);
        var fetched=call("PUT",url,Map.of("status","DECLARED"),200);
        assertThat(fetched.at("/client/name").asText()).isEqualTo("Client initial");
        assertThat(fetched.at("/items/0/product/name").asText()).isEqualTo("New Halayeb");
        assertThat(fetched.at("/items/0/tvaRate").decimalValue()).isEqualByComparingTo(".2");
        call("DELETE","/clients/"+client,null,409);
    }
    @Test void supplierDocumentsPaymentsAndHistoryMatchLegacyContract()throws Exception{
        var bon=call("POST","/bon-achat",Map.of("supplierId",supplier,"items",List.of(line(product,200,100,3,100,true,true))),201);
        String url="/bon-achat/"+bon.get("id").asText();
        assertThat(bon.get("totalAmount").decimalValue()).isEqualByComparingTo("600");
        assertThat(bon.at("/items/0/lineTotal").decimalValue()).isEqualByComparingTo("600");
        var paid=call("POST",url+"/payments",Map.of("amount",600,"method","BANK_TRANSFER"),201);
        assertThat(paid.at("/bon/status").asText()).isEqualTo("COMPLETED");
        var edited=call("PUT",url,Map.of("items",List.of(line(product,200,100,4,100,true,false))),200);
        assertThat(edited.get("remainingAmount").decimalValue()).isEqualByComparingTo("200");
        assertThat(edited.get("status").asText()).isEqualTo("PENDING");
        var history=call("GET","/suppliers/"+supplier+"/documents",null,200);assertThat(history.size()).isEqualTo(1);
        assertThat(call("GET","/clients/"+client+"/documents",null,200).size()).isZero();
    }
    @Test void rejectsInvalidDimensionsPiecesAndMissingAuthentication()throws Exception{
        call("POST","/factures",Map.of("clientId",client,"items",List.of(line(product,0,100,1,200,false,false))),400);
        var invalid=new HashMap<>(line(product,100,100,1,200,false,false));invalid.put("quantity",1.5);
        call("POST","/factures",Map.of("clientId",client,"items",List.of(invalid)),400);
        invalid.put("quantity",1);invalid.put("tvaPercent",101);
        call("POST","/factures",Map.of("clientId",client,"items",List.of(invalid)),400);
        token=null;call("GET","/factures",null,401);call("GET","/products",null,401);
    }
    @Test void roundingIdentityAndMetreConversion()throws Exception{
        var item=new HashMap<String,Object>(line(product,1,1,1,100,false,false));item.put("dimensionUnit","M");item.put("unitPriceTtc",100.11);
        var f=invoice(item);assertThat(f.get("totalHt").decimalValue()).isEqualByComparingTo("83.43");assertThat(f.get("totalTva").decimalValue()).isEqualByComparingTo("16.68");
        assertThat(f.get("totalHt").decimalValue().add(f.get("totalTva").decimalValue())).isEqualByComparingTo(f.get("totalTtc").decimalValue());
    }
    @Test void invoiceEditKeepsOrderAndSubtotalMarkersAndSupportsFilters()throws Exception{
        var f=invoice(line(product,100,100,1,200,false,true));String id=f.get("id").asText();
        var updated=call("PUT","/factures/"+id,Map.of("items",List.of(line(second,200,100,2,140,false,false),line(product,100,100,1,200,false,true))),200);
        assertThat(updated.at("/items/0/productId").asText()).isEqualTo(second);assertThat(updated.at("/items/1/subtotalAfter").asBoolean()).isTrue();
        var filtered=call("GET","/factures?clientId="+client+"&minTtc=700&paymentMethod=ESPECE,VIREMENT",null,200);assertThat(filtered.size()).isZero();
        assertThat(call("GET","/factures?clientId="+client+"&minTtc=700",null,200).size()).isEqualTo(1);
        assertThat(call("GET","/factures/by-code/"+updated.get("code").asText(),null,200).get("id").asText()).isEqualTo(id);
    }
    @Test void localhostBrowserOriginCanLogIn()throws Exception{
        mvc.perform(options("/auth/login").header("Origin","http://127.0.0.1:8080").header("Access-Control-Request-Method","POST").header("Access-Control-Request-Headers","content-type"))
            .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin","http://127.0.0.1:8080"));
    }
    @Test void invoiceNumbersAreAutomaticMonthlyAndCannotBeOverridden()throws Exception{
        var body=new HashMap<String,Object>();body.put("clientId",client);body.put("date","2099-01-10");body.put("code","MANUAL-NUMBER");body.put("items",List.of(line(product,100,100,1,200,false,false)));
        var first=call("POST","/factures",body,201);var next=call("POST","/factures",body,201);
        assertThat(first.get("code").asText()).isEqualTo("01-01-2099");assertThat(next.get("code").asText()).isEqualTo("02-01-2099");
        var edited=call("PUT","/factures/"+first.get("id").asText(),Map.of("code","OVERRIDE","date","2099-02-10"),200);
        assertThat(edited.get("code").asText()).isEqualTo("01-02-2099");
        body.put("date","2099-02-10");assertThat(call("POST","/factures",body,201).get("code").asText()).isEqualTo("02-02-2099");
    }
    @Test void numberPreviewRequiresLoginValidatesDatesAndDoesNotReserve()throws Exception{
        mvc.perform(get("/factures/number-preview").param("date","2180-12-01")).andExpect(status().isUnauthorized());
        var first=call("GET","/factures/number-preview?date=2180-12-01",null,200);
        assertThat(first.get("code").asText()).isEqualTo("01-12-2180");
        assertThat(call("GET","/factures/number-preview?date=2180-12-02",null,200).get("code")).isEqualTo(first.get("code"));
        call("POST","/factures",Map.of("clientId",client,"date","2180-12-01","items",List.of()),400);
        assertThat(call("GET","/factures/number-preview?date=2180-12-02",null,200).get("code")).isEqualTo(first.get("code"));
        call("GET","/factures/number-preview?date=invalid",null,400);
        call("GET","/factures/number-preview",null,400);
    }
    @Test void vatIsAlwaysTwentyPercentEvenWithDifferentCatalogDefaults()throws Exception{
        call("PUT","/products/"+product,Map.of("tvaPercent",10),400);
        var item=new HashMap<String,Object>(line(product,100,100,1,120,false,false));item.put("tvaPercent",10);
        call("POST","/factures",Map.of("clientId",client,"items",List.of(item)),400);
        item.remove("tvaPercent");item.put("tvaRate",0);
        var f=invoice(item);assertThat(f.at("/items/0/tvaRate").decimalValue()).isEqualByComparingTo("0.20");
        assertThat(f.get("totalHt").decimalValue()).isEqualByComparingTo("100.00");assertThat(f.get("totalTva").decimalValue()).isEqualByComparingTo("20.00");
    }

    @Test void companyProfilePersistsAndOnlyNewDocumentsUseTheNewDetails()throws Exception{
        var before=invoice(line(product,100,100,1,120,false,false));
        var settings=new HashMap<String,Object>();settings.put("company_name","Pierre Société");settings.put("company_address","Adresse de test Tanger");settings.put("company_phone_fix","0539000000");settings.put("company_phone_mobile","0661000000");settings.put("company_phone_whatsapp","0600630043");settings.put("company_email","test@example.test");settings.put("company_rc","RC-TEST");settings.put("company_if","IF-TEST");settings.put("company_ice","001234567890123");settings.put("company_patente","PAT-TEST");settings.put("company_cnss","CNSS-TEST");
        call("PUT","/auth/profile",settings,200);
        var profile=call("GET","/auth/verify",null,200).at("/user/company");assertThat(profile.get("phone_fix").asText()).isEqualTo("0539000000");assertThat(profile.get("ice").asText()).isEqualTo("001234567890123");assertThat(profile.get("phone_whatsapp").asText()).isEqualTo("0600630043");
        var after=invoice(line(product,100,100,1,120,false,false));assertThat(after.at("/company/rc").asText()).isEqualTo("RC-TEST");assertThat(after.at("/company/phone_whatsapp").asText()).isEqualTo("0600630043");
        assertThat(call("GET","/factures/"+before.get("id").asText(),null,200).at("/company/phone_whatsapp").isNull()).isTrue();
        call("PUT","/auth/profile",Map.of("company_phone_whatsapp","1".repeat(21)),400);
        assertThat(call("GET","/factures/"+before.get("id").asText(),null,200).at("/company/name").asText()).isEqualTo("ARABIC STONE");
        call("PUT","/auth/profile",Map.of("username","renamed-admin"),200);seed.run(null);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users",Long.class)).isEqualTo(1);
        call("GET","/auth/verify",null,200);
    }
    @Test void currentPrintCompanyFollowsSettingsWithoutChangingTheHistoricalInvoice()throws Exception{
        var before=invoice(line(product,100,100,1,120,false,false));String url="/factures/"+before.get("id").asText();
        var oldCompany=before.get("company");var oldClient=before.get("client");
        call("PUT","/auth/profile",Map.of("company_name","Stone Company Updated","company_address","New address","company_ice","001234567890123","company_phone_mobile","0661000022"),200);
        var after=call("GET",url,null,200);
        assertThat(after.at("/printCompany/name").asText()).isEqualTo("Stone Company Updated");
        assertThat(after.at("/printCompany/address").asText()).isEqualTo("New address");
        assertThat(after.at("/printCompany/phone_mobile").asText()).isEqualTo("0661000022");
        assertThat(after.at("/printCompany/ice").asText()).isEqualTo("001234567890123");
        assertThat(after.get("company")).isEqualTo(oldCompany);assertThat(after.get("client")).isEqualTo(oldClient);
        for(String key:List.of("items","code","date","totalHt","totalTva","totalTtc"))assertThat(after.get(key)).isEqualTo(before.get(key));
        assertThat(after.get("printCompany").toString()).doesNotContain("password","token");
        jdbc.update("UPDATE factures SET created_by=NULL WHERE id=?",before.get("id").asText());
        assertThat(call("GET",url,null,200).at("/printCompany/name").asText()).isEqualTo("Stone Company Updated");
    }
    @Test void numbersAreNotReusedAfterDeletingLastInvoice()throws Exception{
        var body=Map.of("clientId",client,"date","2098-03-10","items",List.of(line(product,100,100,1,120,false,false)));
        var first=call("POST","/factures",body,201);call("DELETE","/factures/"+first.get("id").asText(),null,204);
        assertThat(call("POST","/factures",body,201).get("code").asText()).isEqualTo("02-03-2098");
    }
    @Test void dashboardAndPagedHistoryIncludeMoreThanTenThousandDocuments()throws Exception{
        var original=invoice(line(product,100,100,1,120,false,false));String id=original.get("id").asText();
        var batch=new ArrayList<Object[]>();
        for(int i=0;i<10050;i++)batch.add(new Object[]{"growth-"+i,"GROWTH-"+i,java.sql.Date.valueOf(i%2==0?"2024-01-10":"2026-10-10"),id});
        jdbc.batchUpdate("INSERT INTO factures(id,code,date,client_id,status,payment_method,total_ht,total_tva,total_ttc,client_snapshot,company_snapshot) SELECT ?,?,?,client_id,status,payment_method,total_ht,total_tva,total_ttc,client_snapshot,company_snapshot FROM factures WHERE id=?",batch);
        var lineBatch=new ArrayList<Object[]>();String originalLine=original.at("/items/0/id").asText();
        for(int i=0;i<10050;i++)for(int position=0;position<10;position++){
            lineBatch.add(new Object[]{"gl-"+i+"-"+position,"growth-"+i,position,originalLine});
            if(lineBatch.size()==1000){insertGrowthLines(lineBatch);lineBatch.clear();}
        }
        if(!lineBatch.isEmpty())insertGrowthLines(lineBatch);
        call("POST","/factures/"+id+"/payments",Map.of("amount",50,"method","ESPECE"),201);
        call("POST","/factures/"+id+"/payments",Map.of("amount",70,"method","ESPECE"),201);
        long started=System.nanoTime();var dashboard=call("GET","/dashboard",null,200);long elapsed=(System.nanoTime()-started)/1000000;
        assertThat(dashboard.get("invoiceCount").asInt()).isEqualTo(10051);
        assertThat(dashboard.get("sales").decimalValue()).isEqualByComparingTo("1206120");assertThat(dashboard.get("paid").decimalValue()).isEqualByComparingTo("120");assertThat(dashboard.get("remaining").decimalValue()).isEqualByComparingTo("1206000");
        assertThat(dashboard.get("recentInvoices").size()).isEqualTo(5);assertThat(dashboard.at("/recentInvoices/0").has("items")).isFalse();
        var page=call("GET","/factures?paged=true&search=GROWTH-&page=201&pageSize=50",null,200);assertThat(page.get("total").asInt()).isEqualTo(10050);assertThat(page.get("data").size()).isEqualTo(50);
        assertThat(call("GET","/factures?paged=true&dateTo=2024-12-31&pageSize=1",null,200).get("total").asInt()).isEqualTo(5025);
        var history=call("GET","/clients/"+client+"/documents?paged=true&page=202&pageSize=50",null,200);assertThat(history.get("data").size()).isEqualTo(1);assertThat(history.at("/summary/totalAmount").decimalValue()).isEqualByComparingTo("1206120");assertThat(history.at("/summary/paidAmount").decimalValue()).isEqualByComparingTo("120");
        System.out.println("GROWTH CHECK: 10051 invoices and 100501 lines, dashboard response "+elapsed+" ms (local test, not a production guarantee)");
    }

    @Test void cancelledPurchasesAreExcludedFromDashboardAndHistoryBalances()throws Exception{
        var body=new HashMap<String,Object>();body.put("supplierId",supplier);body.put("items",List.of(line(product,100,100,1,120,true,false)));
        call("POST","/bon-achat",body,201);body.put("status","CANCELLED");call("POST","/bon-achat",body,201);
        assertThat(call("GET","/dashboard",null,200).get("purchases").decimalValue()).isEqualByComparingTo("120");
        var history=call("GET","/suppliers/"+supplier+"/documents?paged=true",null,200);assertThat(history.get("total").asInt()).isEqualTo(2);assertThat(history.at("/summary/totalAmount").decimalValue()).isEqualByComparingTo("120");
    }
    @Test void growthIndexesAreInstalled()throws Exception{
        try(var connection=jdbc.getDataSource().getConnection()){
            for(var entry:Map.of("factures",Set.of("idx_factures_date_id","idx_factures_client"),"payments",Set.of("idx_payments_facture_date","idx_payments_bon_date")).entrySet()){
                var indexes=new HashSet<String>();try(var rows=connection.getMetaData().getIndexInfo(null,null,entry.getKey(),false,false)){while(rows.next()){String name=rows.getString("INDEX_NAME");if(name!=null)indexes.add(name.toLowerCase(Locale.ROOT));}}
                assertThat(indexes).containsAll(entry.getValue());
            }
        }
    }
    private void insertGrowthLines(List<Object[]> batch){
        jdbc.batchUpdate("INSERT INTO facture_lines(id,facture_id,position,product_id,product_name,product_code,length,width,dimension_unit,quantity,surface,unit_price_ttc,tva_rate,line_total_ht,line_total_tva,line_total_ttc,subtotal_after) SELECT ?,?,?,product_id,product_name,product_code,length,width,dimension_unit,quantity,surface,12,tva_rate,10,2,12,FALSE FROM facture_lines WHERE id=?",batch);
    }
}
