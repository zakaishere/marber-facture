package com.stock.management.common.error;

import jakarta.validation.ConstraintViolationException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.BindException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        return validationResponse(ex.getBindingResult());
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ErrorResponse> handleBind(BindException ex) {
        return validationResponse(ex.getBindingResult());
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex) {
        List<Object> errors = new ArrayList<>();
        ex.getConstraintViolations().forEach(violation -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("type", "field");
            item.put("msg", violation.getMessage());
            item.put("path", violation.getPropertyPath().toString());
            item.put("location", "body");
            errors.add(item);
        });
        return ResponseEntity.badRequest().body(new ErrorResponse("Validation error", errors));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex) {
        log.warn("Business error: {}", ex.getMessage());
        return ResponseEntity.status(ex.getStatus()).body(new ErrorResponse(ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleGeneric(Exception ex) {
        log.error("Unhandled error: {}", ex.getMessage(), ex);
        String message = ex.getMessage() != null ? ex.getMessage() : "Internal server error";
        HttpStatus status = mapMessageToStatus(ex.getMessage());
        return ResponseEntity.status(status).body(new ErrorResponse(message));
    }

    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ErrorResponse> handleIntegrity(org.springframework.dao.DataIntegrityViolationException ex) {
        return ResponseEntity.status(409).body(new ErrorResponse("Référence déjà utilisée ou élément lié à un document existant."));
    }

    @ExceptionHandler({org.springframework.http.converter.HttpMessageNotReadableException.class, org.springframework.web.method.annotation.MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ErrorResponse> handleUnreadable(Exception ex) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Données invalides. Vérifiez les nombres, les dates et les champs requis."));
    }

    private ResponseEntity<ErrorResponse> validationResponse(BindingResult bindingResult) {
        List<Object> errors = new ArrayList<>();
        for (FieldError fieldError : bindingResult.getFieldErrors()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("type", "field");
            item.put("msg", fieldError.getDefaultMessage());
            item.put("path", fieldError.getField());
            item.put("location", "body");
            errors.add(item);
        }
        bindingResult.getGlobalErrors().forEach(globalError -> {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("type", "global");
            item.put("msg", globalError.getDefaultMessage());
            item.put("location", "body");
            errors.add(item);
        });
        return ResponseEntity.badRequest().body(new ErrorResponse("Validation error", errors));
    }

    static HttpStatus mapMessageToStatus(String message) {
        if (message != null) {
            if (message.contains("not found")) {
                return HttpStatus.NOT_FOUND;
            }
            if (message.contains("already exists") || message.contains("duplicate")) {
                return HttpStatus.CONFLICT;
            }
            if (message.contains("cannot be negative") || message.contains("exceeds")) {
                return HttpStatus.BAD_REQUEST;
            }
        }
        return HttpStatus.INTERNAL_SERVER_ERROR;
    }
}
