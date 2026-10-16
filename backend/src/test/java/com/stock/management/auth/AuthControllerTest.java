package com.stock.management.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.stock.management.auth.dto.CompanyResponse;
import com.stock.management.auth.dto.LoginRequest;
import com.stock.management.auth.dto.LoginResponse;
import com.stock.management.auth.dto.UserResponse;
import com.stock.management.common.error.BadRequestException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(controllers = AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @MockBean
    private JwtService jwtService;

    @MockBean
    private com.stock.management.user.UserRepository users;

    @MockBean
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Test
    void loginReturnsTokenAndUser() throws Exception {
        CompanyResponse company = new CompanyResponse("ACME", null, null, null, null, null, null, null, null, null, null);
        UserResponse user = new UserResponse("id-1", "alice", "ROLE_ADMIN", company);
        when(authService.login(any())).thenReturn(new LoginResponse("Login successful", "jwt-token", user));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alice\",\"password\":\"secret\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message").value("Login successful"))
            .andExpect(jsonPath("$.token").value("jwt-token"))
            .andExpect(jsonPath("$.user.username").value("alice"))
            .andExpect(jsonPath("$.user.role").value("ROLE_ADMIN"))
            .andExpect(jsonPath("$.user.company.name").value("ACME"));
    }

    @Test
    void loginWithBadCredentialsReturns401() throws Exception {
        when(authService.login(any())).thenThrow(new IncorrectCredentialsException("Invalid username or password"));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"alice\",\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void loginWithMissingFieldsReturns400() throws Exception {
        when(authService.login(any(LoginRequest.class)))
            .thenThrow(new BadRequestException("Username and password are required"));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Username and password are required"));
    }
}
