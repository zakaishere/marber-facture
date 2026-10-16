package com.stock.management.invoicing;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

/** Runs the same workflows against real PostgreSQL when Docker is available. */
@Testcontainers(disabledWithoutDocker=true)
class PostgresWorkflowTest extends WorkflowTest {
    @Container static PostgreSQLContainer<?> postgres=new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties){
        properties.add("spring.flyway.locations",()->"classpath:db/migration,classpath:db/postgresql");
        properties.add("spring.datasource.url",postgres::getJdbcUrl);
        properties.add("spring.datasource.username",postgres::getUsername);
        properties.add("spring.datasource.password",postgres::getPassword);
        properties.add("spring.datasource.driver-class-name",()->"org.postgresql.Driver");
    }
}

