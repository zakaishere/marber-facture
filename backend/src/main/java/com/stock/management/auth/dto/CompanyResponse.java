package com.stock.management.auth.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CompanyResponse(
    String name,
    String activity,
    String address,
    @JsonProperty("phone_fix") String phoneFix,
    @JsonProperty("phone_mobile") String phoneMobile,
    String email,
    String rc,
    @JsonProperty("if") String ifNumber,
    String patente,
    String cnss,
    String ice,
    @JsonProperty("phone_whatsapp") String phoneWhatsapp
) {
}
