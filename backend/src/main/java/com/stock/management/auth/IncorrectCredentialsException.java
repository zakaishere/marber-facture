package com.stock.management.auth;

import com.stock.management.common.error.ApiException;
import org.springframework.http.HttpStatus;

public class IncorrectCredentialsException extends ApiException {

    public IncorrectCredentialsException(String message) {
        super(HttpStatus.UNAUTHORIZED, message);
    }
}
