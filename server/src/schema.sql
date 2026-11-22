CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  logo TEXT,
  must_change_password INTEGER NOT NULL DEFAULT 0,   -- 1 after an admin password reset
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked')),
  expires_at TEXT,                       -- NULL = no payment approved yet
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  method TEXT NOT NULL CHECK (method IN ('HBL','JazzCash')),
  months INTEGER NOT NULL CHECK (months BETWEEN 1 AND 12),   -- subscription length bought
  amount INTEGER NOT NULL,
  txn_ref TEXT NOT NULL,
  screenshot TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  note TEXT,
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS dealers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  type TEXT NOT NULL CHECK (type IN ('hardware','electronic')),
  name TEXT NOT NULL,
  company TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  seq INTEGER NOT NULL,
  bill_no TEXT NOT NULL,
  dealer_id INTEGER NOT NULL REFERENCES dealers(id),
  bill_date TEXT NOT NULL,               -- YYYY-MM-DD (set automatically by the server)
  items TEXT NOT NULL,                   -- JSON [{name,qty,price}]
  total REAL NOT NULL,
  bill_image TEXT,                       -- file name of the supplier's bill photo (stored privately in DATA_DIR/bills)
  created_at TEXT NOT NULL,
  UNIQUE (shop_id, seq)
);

CREATE TABLE IF NOT EXISTS sale_bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  seq INTEGER NOT NULL,
  bill_no TEXT NOT NULL,
  bill_date TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('hardware','electronic')),
  items TEXT NOT NULL,
  total REAL NOT NULL,
  profit REAL NOT NULL DEFAULT 0,
  voided INTEGER NOT NULL DEFAULT 0,     -- 1 = cancelled (kept for the record, excluded from totals)
  created_at TEXT NOT NULL,
  UNIQUE (shop_id, seq)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER,
  actor TEXT NOT NULL,                   -- 'shop' or 'admin'
  action TEXT NOT NULL,
  details TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','dismissed')),
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

-- Customers who buy on credit (udhaar / khata)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (shop_id, phone)
);

-- One row per credit given ('credit') or payment received ('payment').
-- Balance owed by a customer = SUM(credit) - SUM(payment), ignoring voided rows.
CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL CHECK (type IN ('credit','payment')),
  seq INTEGER NOT NULL,                  -- separate sequence per type: CR-0001, PY-0001
  ref_no TEXT NOT NULL,
  entry_date TEXT NOT NULL,              -- YYYY-MM-DD (set automatically by the server)
  items TEXT,                            -- JSON [{name,qty,price}] for credits
  note TEXT,
  amount REAL NOT NULL CHECK (amount > 0),
  sale_bill_id INTEGER REFERENCES sale_bills(id),   -- set when the credit was also recorded as a sale
  voided INTEGER NOT NULL DEFAULT 0,
  void_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE (shop_id, type, seq)
);

CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);

CREATE INDEX IF NOT EXISTS idx_pb_shop_date ON purchase_bills(shop_id, bill_date);
CREATE INDEX IF NOT EXISTS idx_sb_shop_date ON sale_bills(shop_id, bill_date);
CREATE INDEX IF NOT EXISTS idx_dealers_shop ON dealers(shop_id);
CREATE INDEX IF NOT EXISTS idx_pwreq_status ON password_requests(status);
CREATE INDEX IF NOT EXISTS idx_cust_shop ON customers(shop_id, name);
CREATE INDEX IF NOT EXISTS idx_led_customer ON ledger_entries(shop_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_pay_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_act_shop ON activity_logs(shop_id, id);
