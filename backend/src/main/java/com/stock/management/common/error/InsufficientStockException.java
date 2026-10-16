package com.stock.management.common.error;

import org.springframework.http.HttpStatus;

public class InsufficientStockException extends ApiException {

    public InsufficientStockException(String message) {
        super(HttpStatus.BAD_REQUEST, message);
    }
}
