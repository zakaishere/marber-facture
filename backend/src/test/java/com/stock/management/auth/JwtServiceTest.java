package com.stock.management.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.stock.management.user.Role;
import com.stock.management.user.User;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

class JwtServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef";

    private final JwtService jwtService = new JwtService(SECRET, 60_000);

    @Test
    void generatedTokenCarriesIdUsernameAndRoleClaims() {
        User user = new User();
        user.setId("clh3k9d0v0000abcd1234efgh");
        user.setUsername("alice");
        user.setRole(Role.ROLE_ADMIN);

        String token = jwtService.generate(user);
        assertNotNull(token);

        Claims claims = jwtService.parse(token);
        assertEquals("clh3k9d0v0000abcd1234efgh", claims.get("id"));
        assertEquals("alice", claims.get("username"));
        assertEquals("ROLE_ADMIN", claims.get("role"));
        assertEquals("alice", claims.getSubject());
    }
}
