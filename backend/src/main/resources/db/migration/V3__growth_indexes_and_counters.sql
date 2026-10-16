-- Stable sorting, date filters, payment history and FK maintenance as documents accumulate.
CREATE INDEX idx_factures_date_id ON factures(date DESC,id);
CREATE INDEX idx_bons_date_id ON bon_achats(date DESC,id);
CREATE INDEX idx_factures_status_date ON factures(status,date DESC,id);
CREATE INDEX idx_bons_status_date ON bon_achats(status,date DESC,id);
CREATE INDEX idx_clients_name_id ON clients(name,id);
CREATE INDEX idx_suppliers_name_id ON suppliers(name,id);
CREATE INDEX idx_products_name_id ON products(name,id);
CREATE INDEX idx_facture_lines_product ON facture_lines(product_id);
CREATE INDEX idx_bon_lines_product ON bon_achat_lines(product_id);
CREATE INDEX idx_payments_facture_date ON payments(facture_id,date,created_at,id);
CREATE INDEX idx_payments_bon_date ON payments(bon_achat_id,date,created_at,id);
CREATE TABLE document_counters (
 kind VARCHAR(20) NOT NULL REFERENCES document_sequences(kind),
 prefix VARCHAR(32) NOT NULL, last_value INTEGER NOT NULL CHECK(last_value>=0),
 PRIMARY KEY(kind,prefix)
);
