package com.stock.management.ops;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stock.management.auth.JwtAuthFilter;
import com.stock.management.auth.JwtService;
import com.stock.management.config.SecurityConfig;
import java.sql.Connection;
import java.sql.SQLException;
import javax.sql.DataSource;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(OpsController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtService.class})
class OpsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private DataSource dataSource;

    @MockBean
    private com.stock.management.user.UserRepository users;

    @Test
    void pingReturnsAlivePayload() throws Exception {
        mockMvc.perform(get("/ping"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"))
            .andExpect(jsonPath("$.message").value("Service is alive"))
            .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void healthReturnsOkWhenDatabaseReachable() throws Exception {
        Connection connection = mock(Connection.class);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);
        var metadata = mock(java.sql.DatabaseMetaData.class);
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getDatabaseProductName()).thenReturn("PostgreSQL");
        when(metadata.getURL()).thenReturn("jdbc:postgresql://localhost/marble");

        mockMvc.perform(get("/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("ok"))
            .andExpect(jsonPath("$.database").value("connected"))
            .andExpect(jsonPath("$.storage").value("persistent"))
            .andExpect(jsonPath("$.timestamp").isNotEmpty());
    }

    @Test
    void healthReturns503WhenDatabaseDown() throws Exception {
        when(dataSource.getConnection()).thenThrow(new SQLException("db down"));

        mockMvc.perform(get("/health"))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.status").value("error"))
            .andExpect(jsonPath("$.database").value("disconnected"))
            .andExpect(jsonPath("$.error").doesNotExist());
    }
}
