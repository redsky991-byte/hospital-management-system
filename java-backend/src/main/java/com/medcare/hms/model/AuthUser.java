package com.medcare.hms.model;

public class AuthUser {
    public String id;
    public String name;
    public String email;
    public String role;
    public String site_id;

    public AuthUser(String id, String name, String email, String role, String site_id) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.role = role;
        this.site_id = site_id;
    }
}
