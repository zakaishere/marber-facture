-- PostgreSQL substring searches need trigram indexes; ordinary name indexes cannot serve LIKE '%term%'.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_clients_search ON clients USING GIN (LOWER(name) gin_trgm_ops);
CREATE INDEX idx_suppliers_search ON suppliers USING GIN (LOWER(name) gin_trgm_ops);
CREATE INDEX idx_products_search ON products USING GIN (LOWER(name) gin_trgm_ops);
CREATE INDEX idx_products_code_search ON products USING GIN (LOWER(code) gin_trgm_ops);
CREATE INDEX idx_factures_code_search ON factures USING GIN (LOWER(code) gin_trgm_ops);
CREATE INDEX idx_bons_code_search ON bon_achats USING GIN (LOWER(code) gin_trgm_ops);
