CREATE TABLE users (
    id VARCHAR(25) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'ROLE_EMPLOYEE',

    company_name VARCHAR(200),
    company_activity VARCHAR(255),
    company_address TEXT,
    company_phone_fix VARCHAR(20),
    company_phone_mobile VARCHAR(20),
    company_email VARCHAR(255),

    company_rc VARCHAR(50),
    company_if VARCHAR(50),
    company_patente VARCHAR(50),
    company_cnss VARCHAR(50),
    company_ice VARCHAR(15),

    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
