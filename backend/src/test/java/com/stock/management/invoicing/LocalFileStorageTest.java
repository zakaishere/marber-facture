package com.stock.management.invoicing;

import com.fasterxml.jackson.databind.*;
import java.nio.file.*;
import java.sql.*;
import java.util.*;
import org.h2.tools.Restore;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.*;
import org.springframework.test.web.servlet.*;
import static org.assertj.core.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test") @DirtiesContext
class LocalFileStorageTest {
    @TempDir static Path folder;
    @Autowired MockMvc mvc;@Autowired ObjectMapper json;@Autowired Store db;
    static String url(){return "jdbc:h2:file:"+folder.resolve("original").toString().replace('\\','/')+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_ON_EXIT=FALSE";}
    @DynamicPropertySource static void fileDatabase(DynamicPropertyRegistry properties){properties.add("spring.datasource.url",LocalFileStorageTest::url);properties.add("app.local.backup-directory",()->folder.resolve("archives").toString());}
    String token;
    JsonNode call(String path,Object body,int status)throws Exception{
        var request=post(path).contentType("application/json").content(json.writeValueAsString(body));if(token!=null)request.header("Authorization","Bearer "+token);
        return json.readTree(mvc.perform(request).andExpect(status().is(status)).andReturn().getResponse().getContentAsString());
    }
    @Test void savedDataSurvivesShutdownAndBackupRestoresIndependently()throws Exception{
        mvc.perform(post("/auth/local-data/backup")).andExpect(status().isUnauthorized());
        token=call("/auth/login",Map.of("username","admin","password","marble123"),200).get("token").asText();
        var fixture=json.readValue(getClass().getResourceAsStream("/local-import-fixture.json"),Map.class);
        ((Map<String,Object>)((List<?>)fixture.get("factures")).getFirst()).put("notes","Note interne conservée");
        assertThat(call("/auth/local-data/import",fixture,200).get("payments").asInt()).isEqualTo(1);
        call("/auth/local-data/import",fixture,400);
        mvc.perform(get("/factures/saved-invoice").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(jsonPath("$.notes").value("Note interne conservée")).andExpect(jsonPath("$.items[0].subtotalAfter").value(true)).andExpect(jsonPath("$.remainingAmount").value(60));
        String category=call("/categories",Map.of("name","Marbre nouveau"),201).get("id").asText();
        String product=call("/products",Map.of("name","Pierre locale","categoryId",category,"salePrice",120),201).get("id").asText();
        String client=call("/clients",Map.of("name","Client local"),201).get("id").asText();
        String supplier=call("/suppliers",Map.of("name","Fournisseur local"),201).get("id").asText();
        call("/bon-achat",Map.of("supplierId",supplier,"items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",2,"dimensionUnit","CM","unitPrice",100))),201);
        var invoice=call("/factures",Map.of("clientId",client,"items",List.of(Map.of("productId",product,"length",100,"width",100,"quantity",2,"dimensionUnit","CM","unitPriceTtc",120))),201);
        call("/factures/"+invoice.get("id").asText()+"/payments",Map.of("amount",40,"method","ESPECE"),201);
        var backup=mvc.perform(post("/auth/local-data/backup").header("Authorization","Bearer "+token)).andExpect(status().isOk()).andExpect(content().contentType("application/zip")).andReturn().getResponse().getContentAsByteArray();
        Path archive=folder.resolve("downloaded.zip");Files.write(archive,backup);Path restored=folder.resolve("restored");Files.createDirectories(restored);
        Restore.execute(archive.toString(),restored.toString(),"restored");
        try(var connection=DriverManager.getConnection("jdbc:h2:file:"+restored.resolve("restored").toString().replace('\\','/')+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE","sa","");var statement=connection.createStatement()){
            try(var result=statement.executeQuery("SELECT total_ttc-(SELECT SUM(amount) FROM payments p WHERE p.facture_id=d.id) AS balance FROM factures d WHERE d.id='"+invoice.get("id").asText()+"'")){assertThat(result.next()).isTrue();assertThat(result.getBigDecimal("balance")).isEqualByComparingTo("200");}
            try(var result=statement.executeQuery("SELECT notes FROM factures WHERE id='saved-invoice'")){assertThat(result.next()).isTrue();assertThat(result.getString("notes")).isEqualTo("Note interne conservée");}
            statement.execute("SHUTDOWN");
        }
        mvc.perform(get("/health")).andExpect(jsonPath("$.storage").value("persistent")).andExpect(jsonPath("$.databaseEngine").value("H2"));
        db.jdbc.execute("SHUTDOWN");
        try(var connection=DriverManager.getConnection(url(),"sa","");var statement=connection.createStatement();var result=statement.executeQuery("SELECT COUNT(*) FROM facture_lines")){assertThat(result.next()).isTrue();assertThat(result.getInt(1)).isEqualTo(2);}
    }
}
