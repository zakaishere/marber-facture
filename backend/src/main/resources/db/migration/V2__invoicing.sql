CREATE TABLE categories (
 id VARCHAR(25) PRIMARY KEY, name VARCHAR(200) NOT NULL UNIQUE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE app_metadata (name VARCHAR(50) PRIMARY KEY, content VARCHAR(100) NOT NULL);
CREATE TABLE clients (
 id VARCHAR(25) PRIMARY KEY, name VARCHAR(200) NOT NULL, phone VARCHAR(30), address TEXT, ice VARCHAR(15),
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE suppliers (
 id VARCHAR(25) PRIMARY KEY, name VARCHAR(200) NOT NULL, phone VARCHAR(30), address TEXT,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE products (
 id VARCHAR(25) PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, name VARCHAR(200) NOT NULL,
 category_id VARCHAR(25) NOT NULL REFERENCES categories(id),
 sale_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(sale_price>=0),
 last_purchase_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK(last_purchase_price>=0),
 tva_rate NUMERIC(6,5) NOT NULL DEFAULT 0.20 CHECK(tva_rate BETWEEN 0 AND 1),
 quantity NUMERIC(12,3) NOT NULL DEFAULT 0, min_stock NUMERIC(12,3) NOT NULL DEFAULT 0,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE document_sequences (kind VARCHAR(20) PRIMARY KEY);
INSERT INTO document_sequences(kind) VALUES ('FACTURE'),('PURCHASE');
CREATE TABLE factures (
 id VARCHAR(25) PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, date DATE NOT NULL,
 client_id VARCHAR(25) NOT NULL REFERENCES clients(id), status VARCHAR(20) NOT NULL DEFAULT 'NOT_DECLARED' CHECK(status IN ('DECLARED','NOT_DECLARED')),
 payment_method VARCHAR(20), total_ht NUMERIC(14,2) NOT NULL, total_tva NUMERIC(14,2) NOT NULL, total_ttc NUMERIC(14,2) NOT NULL,
 client_snapshot TEXT NOT NULL, company_snapshot TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE bon_achats (
 id VARCHAR(25) PRIMARY KEY, code VARCHAR(50) NOT NULL UNIQUE, date DATE NOT NULL,
 supplier_id VARCHAR(25) NOT NULL REFERENCES suppliers(id), status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COMPLETED','CANCELLED')),
 payment_method VARCHAR(20) NOT NULL DEFAULT 'CASH', total_ht NUMERIC(14,2) NOT NULL, total_tva NUMERIC(14,2) NOT NULL, total_amount NUMERIC(14,2) NOT NULL,
 supplier_snapshot TEXT NOT NULL, company_snapshot TEXT NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE facture_lines (
 id VARCHAR(25) PRIMARY KEY, facture_id VARCHAR(25) NOT NULL REFERENCES factures(id) ON DELETE CASCADE,
 product_id VARCHAR(25) NOT NULL REFERENCES products(id), product_name VARCHAR(200) NOT NULL, product_code VARCHAR(50) NOT NULL,
 length NUMERIC(12,3) NOT NULL CHECK(length>0), width NUMERIC(12,3) NOT NULL CHECK(width>0), dimension_unit VARCHAR(2) NOT NULL CHECK(dimension_unit IN ('CM','M')),
 quantity INTEGER NOT NULL CHECK(quantity>0), surface NUMERIC(18,6) NOT NULL CHECK(surface>0),
 unit_price_ttc NUMERIC(12,2) NOT NULL CHECK(unit_price_ttc>=0), tva_rate NUMERIC(6,5) NOT NULL CHECK(tva_rate BETWEEN 0 AND 1),
 line_total_ht NUMERIC(14,2) NOT NULL, line_total_tva NUMERIC(14,2) NOT NULL, line_total_ttc NUMERIC(14,2) NOT NULL,
 position INTEGER NOT NULL, subtotal_after BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE bon_achat_lines (
 id VARCHAR(25) PRIMARY KEY, bon_achat_id VARCHAR(25) NOT NULL REFERENCES bon_achats(id) ON DELETE CASCADE,
 product_id VARCHAR(25) NOT NULL REFERENCES products(id), product_name VARCHAR(200) NOT NULL, product_code VARCHAR(50) NOT NULL,
 length NUMERIC(12,3) NOT NULL CHECK(length>0), width NUMERIC(12,3) NOT NULL CHECK(width>0), dimension_unit VARCHAR(2) NOT NULL CHECK(dimension_unit IN ('CM','M')),
 quantity INTEGER NOT NULL CHECK(quantity>0), surface NUMERIC(18,6) NOT NULL CHECK(surface>0),
 unit_price NUMERIC(12,2) NOT NULL CHECK(unit_price>=0), tva_rate NUMERIC(6,5) NOT NULL CHECK(tva_rate BETWEEN 0 AND 1),
 line_total_ht NUMERIC(14,2) NOT NULL, line_total_tva NUMERIC(14,2) NOT NULL, line_total NUMERIC(14,2) NOT NULL,
 position INTEGER NOT NULL, subtotal_after BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE payments (
 id VARCHAR(25) PRIMARY KEY,
 facture_id VARCHAR(25) REFERENCES factures(id), bon_achat_id VARCHAR(25) REFERENCES bon_achats(id),
 amount NUMERIC(14,2) NOT NULL CHECK(amount>0), method VARCHAR(20) NOT NULL,
 date TIMESTAMP NOT NULL, note TEXT, reference VARCHAR(100),
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK((facture_id IS NOT NULL AND bon_achat_id IS NULL) OR (facture_id IS NULL AND bon_achat_id IS NOT NULL))
);
CREATE INDEX idx_factures_client ON factures(client_id,date);
CREATE INDEX idx_bons_supplier ON bon_achats(supplier_id,date);
CREATE INDEX idx_lines_facture ON facture_lines(facture_id,position);
CREATE INDEX idx_lines_bon ON bon_achat_lines(bon_achat_id,position);
CREATE INDEX idx_payments_facture ON payments(facture_id);
CREATE INDEX idx_payments_bon ON payments(bon_achat_id);
CREATE INDEX idx_products_category ON products(category_id);
