package com.stock.management.invoicing;

import com.fasterxml.jackson.databind.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @Transactional
class InvoicingAccountsTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    String token,adminToken;
    JsonNode call(String method,String url,Object body,int expected)throws Exception{
        var request=switch(method){case "POST"->post(url);case "PUT"->put(url);case "PATCH"->patch(url);case "DELETE"->delete(url);default->get(url);};
        if(token!=null)request.header("Authorization","Bearer "+token);
        if(body!=null)request.contentType("application/json").content(json.writeValueAsString(body));
        String text=mvc.perform(request).andExpect(status().is(expected)).andReturn().getResponse().getContentAsString(java.nio.charset.StandardCharsets.UTF_8);
        return text.isBlank()?json.nullNode():json.readTree(text);
    }
    @BeforeEach void login()throws Exception{token=null;adminToken=call("POST","/auth/login",Map.of("username","admin","password","marble123"),200).get("token").asText();token=adminToken;}
    JsonNode account(String name)throws Exception{return call("POST","/auth/accounts",Map.of("username",name,"password","Test-password-123"),201);}
    String loginAs(String name,String password)throws Exception{token=null;String result=call("POST","/auth/login",Map.of("username",name,"password",password),200).get("token").asText();token=result;return result;}
    @Test void restrictedAccountCreatesAndPrintsAllInvoicesButCannotManageAnythingElse()throws Exception{
        String name="staff-"+UUID.randomUUID().toString().substring(0,8);var account=account(name);
        assertThat(account.get("role").asText()).isEqualTo("ROLE_INVOICING");assertThat(account.has("passwordHash")).isFalse();
        String category=call("POST","/categories",Map.of("name","Accounts "+UUID.randomUUID()),201).get("id").asText();
        String product=call("POST","/products",Map.of("name","Marble","categoryId",category,"salePrice",120,"lastPurchasePrice",100),201).get("id").asText();
        String client=call("POST","/clients",Map.of("name","Test client"),201).get("id").asText();
        var body=Map.of("clientId",client,"items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",1,"dimensionUnit","CM","unitPriceTtc",120)));
        var adminInvoice=call("POST","/factures",body,201);String adminId=adminInvoice.get("id").asText();
        loginAs(name,"Test-password-123");var options=call("GET","/invoice-options",null,200);
        assertThat(options.get("products").toString()).doesNotContain("lastPurchasePrice");
        var own=call("POST","/factures",body,201);String id=own.get("id").asText();
        assertThat(own.get("company").get("name").asText()).isEqualTo("ARABIC STONE");
        assertThat(own.has("notes")).isFalse();assertThat(own.get("createdBy").asText()).isEqualTo(account.get("id").asText());
        call("GET","/factures/"+id,null,200);call("GET","/factures/by-code/"+own.get("code").asText(),null,200);
        assertThat(call("GET","/factures/"+adminId,null,200).has("notes")).isFalse();call("GET","/factures/by-code/"+adminInvoice.get("code").asText(),null,200);
        assertThat(call("GET","/factures?paged=true&createdBy="+adminInvoice.get("createdBy").asText(),null,200).get("total").asInt()).isEqualTo(2);
        assertThat(call("GET","/factures?includeItems=true",null,200).size()).isEqualTo(2);
        for(String route:List.of("/auth/accounts","/auth/local-data/backup","/products","/products/summary","/clients","/clients/"+client+"/documents","/categories","/suppliers","/bon-achat","/dashboard","/factures/"+id+"/payments"))call(route.contains("backup")?"POST":"GET",route,null,403);
        call("POST","/auth/accounts",Map.of("username","evil","password","Test-password-123"),403);
        call("PUT","/auth/profile",Map.of("company_name","Forbidden"),403);call("PUT","/api/v1/auth/profile",Map.of("username","evil"),403);
        call("POST","/clients",Map.of("name","Forbidden"),403);call("POST","/bon-achat",Map.of(),403);
        call("PUT","/factures/"+adminId,body,403);call("DELETE","/factures/"+adminId,null,403);call("PUT","/factures/"+id,body,403);call("DELETE","/factures/"+id,null,403);call("PATCH","/factures/"+id+"/notes",Map.of("notes","Forbidden"),403);
        call("POST","/factures/"+id+"/payments",Map.of("amount",1),403);
        token=adminToken;assertThat(call("GET","/factures?paged=true",null,200).get("total").asInt()).isEqualTo(2);
        call("GET","/factures/"+id,null,200);call("PUT","/factures/"+id,Map.of("notes","Admin follow-up"),200);
    }
    @Test void adminControlsAccountsAndChangesInvalidatePreviouslyIssuedTokens()throws Exception{
        String name="staff-"+UUID.randomUUID().toString().substring(0,8);var account=account(name);String id=account.get("id").asText();
        call("POST","/auth/accounts",Map.of("username",name,"password","Test-password-123"),409);
        call("POST","/auth/accounts",Map.of("username","other-staff","password","Test-password-123","role","ROLE_ADMIN"),400);
        call("POST","/auth/accounts",Map.of("username","bad-password","password","short"),400);
        String staffToken=loginAs(name,"Test-password-123");token=adminToken;
        call("PUT","/auth/accounts/"+id,Map.of("enabled",false),200);token=staffToken;call("GET","/auth/verify",null,401);
        token=null;call("POST","/auth/login",Map.of("username",name,"password","Test-password-123"),401);
        token=adminToken;call("PUT","/auth/accounts/"+id,Map.of("enabled",true),200);token=staffToken;call("GET","/factures",null,401);
        staffToken=loginAs(name,"Test-password-123");token=adminToken;call("PUT","/auth/accounts/"+id,Map.of("password","New-password-456"),200);
        token=staffToken;call("GET","/auth/verify",null,401);token=null;call("POST","/auth/login",Map.of("username",name,"password","Test-password-123"),401);
        loginAs(name,"New-password-456");call("GET","/api/v1/auth/verify",null,200);
        token=adminToken;call("PUT","/auth/accounts/"+id,Map.of("role","ROLE_ADMIN"),400);
        assertThat(call("GET","/auth/accounts",null,200).toString()).doesNotContain("password");
    }
}
