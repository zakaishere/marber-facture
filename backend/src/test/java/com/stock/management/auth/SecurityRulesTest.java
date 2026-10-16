package com.stock.management.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stock.management.config.SecurityConfig;
import com.stock.management.user.Role;
import com.stock.management.user.User;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@WebMvcTest(controllers = SecurityProbeController.class)
@Import({SecurityConfig.class, JwtAuthFilter.class, JwtService.class})
class SecurityRulesTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Test
    void protectedEndpointWithoutTokenIsRejected() throws Exception {
        mockMvc.perform(get("/api/v1/probe"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointWithValidTokenIsAllowed() throws Exception {
        User user = new User();
        user.setId("id-1");
        user.setUsername("alice");
        user.setRole(Role.ROLE_EMPLOYEE);
        String token = jwtService.generate(user);

        mockMvc.perform(get("/api/v1/probe").header("Authorization", "Bearer " + token))
            .andExpect(status().isOk())
            .andExpect(content().string("ok"));
    }
}

@RestController
class SecurityProbeController {

    @GetMapping("/api/v1/probe")
    String probe() {
        return "ok";
    }
}
