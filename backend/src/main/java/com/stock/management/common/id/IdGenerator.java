package com.stock.management.common.id;

import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.concurrent.atomic.AtomicLong;
import org.springframework.stereotype.Component;

@Component
public class IdGenerator {

    public static final int DEFAULT_LENGTH = 24;

    private static final char[] DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final AtomicLong counter;
    private final String fingerprint;

    public IdGenerator() {
        this.counter = new AtomicLong(RANDOM.nextLong() & Long.MAX_VALUE);
        this.fingerprint = randomBase36(4);
    }

    public String next() {
        return next(DEFAULT_LENGTH);
    }

    public String next(int length) {
        long count = counter.incrementAndGet();
        String input = Long.toString(count, 36)
            + fingerprint
            + randomBase36(Math.max(length, 8))
            + Long.toString(System.currentTimeMillis(), 36);

        String hash = new BigInteger(1, sha3_512(input)).toString(36);
        if (!Character.isLetter(hash.charAt(0))) {
            hash = (char) ('a' + RANDOM.nextInt(26)) + hash;
        }
        return hash.substring(0, length);
    }

    private static String randomBase36(int length) {
        StringBuilder sb = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            sb.append(DIGITS[RANDOM.nextInt(DIGITS.length)]);
        }
        return sb.toString();
    }

    private static byte[] sha3_512(String input) {
        try {
            return MessageDigest.getInstance("SHA3-512").digest(input.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA3-512 is not available", e);
        }
    }
}
