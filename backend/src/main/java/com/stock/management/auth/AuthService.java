package com.stock.management.auth;

import com.stock.management.auth.dto.LoginRequest;
import com.stock.management.auth.dto.LoginResponse;
import com.stock.management.auth.dto.UserResponse;
import com.stock.management.common.error.BadRequestException;
import com.stock.management.user.User;
import com.stock.management.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    public AuthService(UserRepository users, PasswordEncoder passwordEncoder, JwtService jwtService) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
    }

    public LoginResponse login(LoginRequest request) {
        String username = request == null ? null : request.username();
        String password = request == null ? null : request.password();
        if (username == null || username.isBlank() || password == null || password.isBlank()) {
            throw new BadRequestException("Username and password are required");
        }

        User user = users.findByUsername(username)
            .orElseThrow(() -> new IncorrectCredentialsException("Invalid username or password"));

        if (!user.isEnabled() || !passwordEncoder.matches(password, user.getPasswordHash())) {
            throw new IncorrectCredentialsException("Invalid username or password");
        }

        return new LoginResponse("Login successful", jwtService.generate(user), UserResponse.from(user));
    }
}
