package com.stock.management.config;

import com.stock.management.common.id.IdGenerator;
import com.stock.management.user.Role;
import com.stock.management.user.User;
import com.stock.management.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@org.springframework.core.annotation.Order(0)
public class SeedConfig implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SeedConfig.class);

    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final IdGenerator idGenerator;
    private final String adminUsername;
    private final String adminPassword;

    public SeedConfig(
        UserRepository users,
        PasswordEncoder passwordEncoder,
        IdGenerator idGenerator,
        @Value("${app.admin.username}") String adminUsername,
        @Value("${app.admin.password}") String adminPassword
    ) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.idGenerator = idGenerator;
        this.adminUsername = adminUsername;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        // Renaming the administrator must never recreate the bootstrap account on restart.
        if (users.count() > 0) {
            return;
        }
        User admin = new User();
        admin.setId(idGenerator.next());
        admin.setUsername(adminUsername);
        admin.setPasswordHash(passwordEncoder.encode(adminPassword));
        admin.setRole(Role.ROLE_ADMIN);
        admin.setCompanyName("ARABIC STONE");
        admin.setCompanyActivity("Marbre et pierre naturelle");
        users.save(admin);
        log.info("Seeded admin user '{}'", adminUsername);
    }
}
