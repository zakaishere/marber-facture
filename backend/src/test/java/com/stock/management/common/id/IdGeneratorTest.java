package com.stock.management.common.id;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

class IdGeneratorTest {

    @Test
    void generatesUniqueIdsWithExpectedShape() {
        IdGenerator generator = new IdGenerator();
        Set<String> ids = new HashSet<>();

        for (int i = 0; i < 1000; i++) {
            String id = generator.next();
            assertEquals(24, id.length(), "id length should match CUID2 default");
            assertTrue(id.matches("[a-z0-9]+"), "id must be lowercase alphanumeric: " + id);
            assertTrue(Character.isLetter(id.charAt(0)), "id must start with a letter: " + id);
            ids.add(id);
        }

        assertThat(ids).hasSize(1000);
    }

    @Test
    void supportsCustomLength() {
        IdGenerator generator = new IdGenerator();
        assertEquals(10, generator.next(10).length());
        assertEquals(32, generator.next(32).length());
    }
}
