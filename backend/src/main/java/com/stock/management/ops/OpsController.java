package com.stock.management.ops;

import java.sql.Connection;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class OpsController {

    private final DataSource dataSource;

    public OpsController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @GetMapping("/ping")
    public Map<String, Object> ping() {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", "ok");
        body.put("timestamp", Instant.now().toString());
        body.put("message", "Service is alive");
        return body;
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try (Connection connection = dataSource.getConnection()) {
            if (!connection.isValid(2)) {
                throw new IllegalStateException("Connection is not valid");
            }
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "ok");
            body.put("timestamp", Instant.now().toString());
            body.put("database", "connected");
            body.put("databaseEngine", connection.getMetaData().getDatabaseProductName());
            body.put("storage", connection.getMetaData().getURL().contains(":mem:") ? "temporary" : "persistent");
            return ResponseEntity.ok(body);
        } catch (Exception ex) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "error");
            body.put("timestamp", Instant.now().toString());
            body.put("database", "disconnected");
            return ResponseEntity.status(503).body(body);
        }
    }
}
