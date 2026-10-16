ALTER TABLE users ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN owner_admin_id VARCHAR(25) REFERENCES users(id);
ALTER TABLE factures ADD COLUMN created_by VARCHAR(25) REFERENCES users(id);
CREATE INDEX idx_users_owner_role ON users(owner_admin_id,role);
CREATE INDEX idx_factures_creator_date ON factures(created_by,date,id);
