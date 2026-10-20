package com.stock.management.invoicing;

import java.util.UUID;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import static org.assertj.core.api.Assertions.*;

class CompanyWhatsappMigrationTest {
    @Test void addingWhatsappPreservesAnExistingV8CompanyAndItsContactData(){
        String url="jdbc:h2:mem:whatsapp_"+UUID.randomUUID()+";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1";
        var dataSource=new DriverManagerDataSource(url,"sa","");
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").target(MigrationVersion.fromVersion("8")).load().migrate();
        var jdbc=new JdbcTemplate(dataSource);
        jdbc.update("INSERT INTO users(id,username,password_hash,role,company_name,company_phone_fix,company_phone_mobile) VALUES (?,?,?,?,?,?,?)","migration-user","migration","test-hash","ROLE_ADMIN","Existing stone company","0539000000","0661000000");
        Flyway.configure().dataSource(dataSource).locations("classpath:db/migration").load().migrate();
        var row=jdbc.queryForMap("SELECT company_name,company_phone_fix,company_phone_mobile,company_phone_whatsapp FROM users WHERE id='migration-user'");
        assertThat(row.get("company_name")).isEqualTo("Existing stone company");
        assertThat(row.get("company_phone_fix")).isEqualTo("0539000000");
        assertThat(row.get("company_phone_mobile")).isEqualTo("0661000000");
        assertThat(row.get("company_phone_whatsapp")).isNull();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM users",Integer.class)).isEqualTo(1);
    }
}
