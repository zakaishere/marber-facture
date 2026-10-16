package com.stock.management.common.error;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.standaloneSetup(new ProbeController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
    }

    @Test
    void notFoundMapsTo404() throws Exception {
        mockMvc.perform(get("/nf"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Product not found"))
            .andExpect(jsonPath("$.errors").doesNotExist());
    }

    @Test
    void conflictMapsTo409() throws Exception {
        mockMvc.perform(get("/cf"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message").value("Category already exists"));
    }

    @Test
    void badRequestMapsTo400() throws Exception {
        mockMvc.perform(get("/br"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Quantity cannot be negative"));
    }

    @Test
    void insufficientStockMapsTo400Override() throws Exception {
        mockMvc.perform(get("/stock"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Insufficient stock for product X"));
    }

    @Test
    void rawLegacyMessageNotFoundMapsTo404() throws Exception {
        mockMvc.perform(get("/raw-nf"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("Invoice not found"));
    }

    @Test
    void unknownErrorMapsTo500() throws Exception {
        mockMvc.perform(get("/boom"))
            .andExpect(status().isInternalServerError())
            .andExpect(jsonPath("$.message").value("unexpected"));
    }

    @Test
    void beanValidationProducesLegacyErrorShape() throws Exception {
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();

        MockMvc validationMvc = MockMvcBuilders.standaloneSetup(new ValidationProbeController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .setValidator(validator)
            .build();

        validationMvc.perform(post("/validate")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message").value("Validation error"))
            .andExpect(jsonPath("$.errors[0].msg").value("name is required"))
            .andExpect(jsonPath("$.errors[0].path").value("name"))
            .andExpect(jsonPath("$.errors[0].location").value("body"));
    }

    @RestController
    static class ProbeController {

        @GetMapping("/nf")
        void nf() {
            throw new ResourceNotFoundException("Product not found");
        }

        @GetMapping("/cf")
        void cf() {
            throw new ConflictException("Category already exists");
        }

        @GetMapping("/br")
        void br() {
            throw new BadRequestException("Quantity cannot be negative");
        }

        @GetMapping("/stock")
        void stock() {
            throw new InsufficientStockException("Insufficient stock for product X");
        }

        @GetMapping("/raw-nf")
        void rawNotFound() {
            throw new RuntimeException("Invoice not found");
        }

        @GetMapping("/boom")
        void boom() {
            throw new RuntimeException("unexpected");
        }
    }

    @RestController
    static class ValidationProbeController {

        @PostMapping("/validate")
        String validate(@Valid @RequestBody ProbeRequest body) {
            return "ok";
        }
    }

    record ProbeRequest(@NotBlank(message = "name is required") String name) {
    }
}
