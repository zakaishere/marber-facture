package com.stock.management.auth.dto;

import com.stock.management.user.User;

public record UserResponse(String id, String username, String role, CompanyResponse company) {

    public static UserResponse from(User user) {
        CompanyResponse company = new CompanyResponse(
            user.getCompanyName(),
            user.getCompanyActivity(),
            user.getCompanyAddress(),
            user.getCompanyPhoneFix(),
            user.getCompanyPhoneMobile(),
            user.getCompanyEmail(),
            user.getCompanyRc(),
            user.getCompanyIf(),
            user.getCompanyPatente(),
            user.getCompanyCnss(),
            user.getCompanyIce(),
            user.getCompanyPhoneWhatsapp()
        );
        return new UserResponse(user.getId(), user.getUsername(), user.getRole().name(), company);
    }
}
