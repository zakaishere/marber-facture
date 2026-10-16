package com.stock.management.auth;

import com.stock.management.auth.dto.LoginRequest;
import com.stock.management.auth.dto.LoginResponse;
import com.stock.management.auth.dto.UserResponse;
import com.stock.management.user.*;
import com.stock.management.common.error.BadRequestException;
import com.stock.management.invoicing.Input;
import java.security.Principal;
import java.util.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping({"/auth", "/api/v1/auth"})
public class AuthController {

    private final AuthService authService;

    private final UserRepository users;
    private final PasswordEncoder encoder;
    public AuthController(AuthService authService, UserRepository users, PasswordEncoder encoder) {
        this.authService = authService;
        this.users = users;
        this.encoder = encoder;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody(required = false) LoginRequest request) {
        return authService.login(request);
    }

    @GetMapping("/verify") public Map<String,Object> verify(Principal p){return Map.of("message","Session valide","user",UserResponse.from(current(p)));}
    @PostMapping("/logout") public Map<String,String> logout(){return Map.of("message","Déconnexion effectuée");}
    private User current(Principal p){return users.findById(p.getName()).orElseThrow(()->new IncorrectCredentialsException("Session invalide"));}
    @PutMapping("/profile") @Transactional
    public Map<String,Object> profile(Principal p,@RequestBody Map<String,Object> b){
        User u=current(p);
        if(b.containsKey("username")) u.setUsername(Input.required(b,"username",50));
        String password=Input.text(b.get("password"));
        if(!password.isEmpty()){if(password.length()<6||password.length()>72) throw new BadRequestException("Mot de passe: 6 à 72 caractères");u.setPasswordHash(encoder.encode(password));}
        if(b.containsKey("company_name"))u.setCompanyName(Input.optional(b.get("company_name"),200));
        if(b.containsKey("company_activity"))u.setCompanyActivity(Input.optional(b.get("company_activity"),255));
        if(b.containsKey("company_address"))u.setCompanyAddress(Input.optional(b.get("company_address"),2000));
        if(b.containsKey("company_phone_fix"))u.setCompanyPhoneFix(Input.optional(b.get("company_phone_fix"),20));
        if(b.containsKey("company_phone_mobile"))u.setCompanyPhoneMobile(Input.optional(b.get("company_phone_mobile"),20));
        if(b.containsKey("company_email"))u.setCompanyEmail(Input.optional(b.get("company_email"),255));
        if(b.containsKey("company_rc"))u.setCompanyRc(Input.optional(b.get("company_rc"),50));
        if(b.containsKey("company_if"))u.setCompanyIf(Input.optional(b.get("company_if"),50));
        if(b.containsKey("company_patente"))u.setCompanyPatente(Input.optional(b.get("company_patente"),50));
        if(b.containsKey("company_cnss"))u.setCompanyCnss(Input.optional(b.get("company_cnss"),50));
        if(b.containsKey("company_ice"))u.setCompanyIce(Input.optional(b.get("company_ice"),15));
        return Map.of("message","Profil enregistré","user",UserResponse.from(users.saveAndFlush(u)));
    }
}
