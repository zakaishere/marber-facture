package com.stock.management.auth.dto;

public record LoginResponse(String message, String token, UserResponse user) {
}
