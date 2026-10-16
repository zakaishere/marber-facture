package com.stock.management.common.error;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErrorResponse(String message, List<Object> errors) {

    public ErrorResponse(String message) {
        this(message, null);
    }
}
