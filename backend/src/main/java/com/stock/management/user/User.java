package com.stock.management.user;

import com.stock.management.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User extends BaseEntity {
    @Column(nullable = false) private boolean enabled = true;
    @Column(name="token_version", nullable=false) private int tokenVersion;
    @Column(name="owner_admin_id", length=25) private String ownerAdminId;
    public boolean isEnabled(){return enabled;}
    public void setEnabled(boolean value){enabled=value;}
    public int getTokenVersion(){return tokenVersion;}
    public void setTokenVersion(int value){tokenVersion=value;}
    public String getOwnerAdminId(){return ownerAdminId;}
    public void setOwnerAdminId(String value){ownerAdminId=value;}

    @Column(name = "username", nullable = false, unique = true, length = 50)
    private String username;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private Role role = Role.ROLE_EMPLOYEE;

    @Column(name = "company_name", length = 200)
    private String companyName;

    @Column(name = "company_activity", length = 255)
    private String companyActivity;

    @Column(name = "company_address")
    private String companyAddress;

    @Column(name = "company_phone_fix", length = 20)
    private String companyPhoneFix;

    @Column(name = "company_phone_mobile", length = 20)
    private String companyPhoneMobile;

    @Column(name = "company_email", length = 255)
    private String companyEmail;

    @Column(name = "company_rc", length = 50)
    private String companyRc;

    @Column(name = "company_if", length = 50)
    private String companyIf;

    @Column(name = "company_patente", length = 50)
    private String companyPatente;

    @Column(name = "company_cnss", length = 50)
    private String companyCnss;

    @Column(name = "company_ice", length = 15)
    private String companyIce;

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public Role getRole() {
        return role;
    }

    public void setRole(Role role) {
        this.role = role;
    }

    public String getCompanyName() {
        return companyName;
    }

    public void setCompanyName(String companyName) {
        this.companyName = companyName;
    }

    public String getCompanyActivity() {
        return companyActivity;
    }

    public void setCompanyActivity(String companyActivity) {
        this.companyActivity = companyActivity;
    }

    public String getCompanyAddress() {
        return companyAddress;
    }

    public void setCompanyAddress(String companyAddress) {
        this.companyAddress = companyAddress;
    }

    public String getCompanyPhoneFix() {
        return companyPhoneFix;
    }

    public void setCompanyPhoneFix(String companyPhoneFix) {
        this.companyPhoneFix = companyPhoneFix;
    }

    public String getCompanyPhoneMobile() {
        return companyPhoneMobile;
    }

    public void setCompanyPhoneMobile(String companyPhoneMobile) {
        this.companyPhoneMobile = companyPhoneMobile;
    }

    public String getCompanyEmail() {
        return companyEmail;
    }

    public void setCompanyEmail(String companyEmail) {
        this.companyEmail = companyEmail;
    }

    public String getCompanyRc() {
        return companyRc;
    }

    public void setCompanyRc(String companyRc) {
        this.companyRc = companyRc;
    }

    public String getCompanyIf() {
        return companyIf;
    }

    public void setCompanyIf(String companyIf) {
        this.companyIf = companyIf;
    }

    public String getCompanyPatente() {
        return companyPatente;
    }

    public void setCompanyPatente(String companyPatente) {
        this.companyPatente = companyPatente;
    }

    public String getCompanyCnss() {
        return companyCnss;
    }

    public void setCompanyCnss(String companyCnss) {
        this.companyCnss = companyCnss;
    }

    public String getCompanyIce() {
        return companyIce;
    }

    public void setCompanyIce(String companyIce) {
        this.companyIce = companyIce;
    }
}
