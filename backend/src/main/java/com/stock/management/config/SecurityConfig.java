package com.stock.management.config;

import com.stock.management.auth.JwtAuthFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .cors(Customizer.withDefaults())
            .csrf(AbstractHttpConfigurer::disable)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(
                    "/", "/index.html", "/css/**", "/js/**", "/favicon.ico",
                    "/ping", "/health", "/api/v1/auth/login", "/auth/login"
                ).permitAll()
                .requestMatchers("/auth/verify", "/auth/logout", "/api/v1/auth/verify", "/api/v1/auth/logout").authenticated()
                .requestMatchers("/auth/local-data/**", "/auth/accounts/**").hasRole("ADMIN")
                .requestMatchers(HttpMethod.GET,"/factures", "/factures/*", "/factures/by-code/*", "/invoice-options").hasAnyRole("ADMIN","INVOICING")
                .requestMatchers(HttpMethod.POST,"/factures").hasAnyRole("ADMIN","INVOICING")
                .requestMatchers("/api/v1/**", "/auth/**", "/products/**", "/categories/**", "/clients/**", "/suppliers/**", "/factures/**", "/bon-achat/**", "/dashboard/**", "/invoice-options/**").hasRole("ADMIN")
                .anyRequest().permitAll())
            .exceptionHandling(entry -> entry.accessDeniedHandler((request,response,ex)->{
                response.setStatus(403);response.setContentType("application/json;charset=UTF-8");response.getWriter().write("{\"message\":\"Accès réservé à l’administrateur\"}");
            }).authenticationEntryPoint((request, response, ex) -> {
                response.setStatus(401);
                response.setContentType("application/json");
                response.getWriter().write("{\"message\":\"Authentication required\"}");
            }))
            .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
