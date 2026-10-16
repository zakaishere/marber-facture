package com.stock.management.user;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, String> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);
    java.util.List<User> findByOwnerAdminIdOrderByUsernameAsc(String ownerAdminId);
}
