-- migrations/002_add_vpn_peers.sql
CREATE TABLE vpn_peers (
    uuid TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    public_key TEXT UNIQUE NOT NULL,
    ip_address TEXT NOT NULL,
    registered_at INTEGER NOT NULL,
    last_handshake INTEGER,
    bytes_sent INTEGER DEFAULT 0,
    bytes_received INTEGER DEFAULT 0,
    revoked BOOLEAN DEFAULT 0,
    revoked_at INTEGER
);

CREATE INDEX idx_vpn_public_key ON vpn_peers(public_key);
CREATE INDEX idx_vpn_username ON vpn_peers(username);
CREATE INDEX idx_vpn_revoked ON vpn_peers(revoked);
