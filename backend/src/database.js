const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'spendly.db');
const DEMO_EMAIL = process.env.DEMO_EMAIL || 'demo@spendly.local';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'demo1234';

const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const ensureColumn = (table, definition) => {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  } catch (error) {
    if (!String(error.message).includes('duplicate column name')) throw error;
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

ensureColumn('users', "currency TEXT NOT NULL DEFAULT 'USD'");

const demoHash = bcrypt.hashSync(DEMO_PASSWORD, 10);
db.prepare(`
  INSERT INTO users (email, password_hash, currency)
  VALUES (?, ?, 'USD')
  ON CONFLICT(email) DO NOTHING
`).run(DEMO_EMAIL, demoHash);

const demoUser = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL);
const demoUserId = demoUser.id;

db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    icon TEXT NOT NULL DEFAULT '💰',
    budget REAL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, name)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    recurring_source_id INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );
`);

const categoryColumns = db.prepare("PRAGMA table_info(categories)").all().map((c) => c.name);
const expenseColumns = db.prepare("PRAGMA table_info(expenses)").all().map((c) => c.name);
const needsMigration =
  !categoryColumns.includes('user_id') ||
  !categoryColumns.includes('budget') ||
  !expenseColumns.includes('user_id');

if (needsMigration) {
  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    db.exec('DROP TABLE IF EXISTS expenses_legacy');
    db.exec('DROP TABLE IF EXISTS categories_legacy');
    db.exec('ALTER TABLE expenses RENAME TO expenses_legacy');
    db.exec('ALTER TABLE categories RENAME TO categories_legacy');

    db.exec(`
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6366f1',
        icon TEXT NOT NULL DEFAULT '💰',
        budget REAL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE (user_id, name)
      );
    `);

    db.exec(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        category_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        notes TEXT,
        recurring_source_id INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
    `);

    db.prepare(`
      INSERT INTO categories (id, user_id, name, color, icon, budget, created_at)
      SELECT id, ?, name, color, icon, NULL, created_at
      FROM categories_legacy
    `).run(demoUserId);

    db.prepare(`
      INSERT INTO expenses (id, user_id, description, amount, category_id, date, notes, recurring_source_id, created_at)
      SELECT id, ?, description, amount, category_id, date, notes, NULL, created_at
      FROM expenses_legacy
    `).run(demoUserId);

    db.exec('DROP TABLE expenses_legacy');
    db.exec('DROP TABLE categories_legacy');
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
}

ensureColumn('categories', 'user_id INTEGER');
ensureColumn('categories', 'budget REAL');
ensureColumn('expenses', 'user_id INTEGER');
ensureColumn('expenses', 'recurring_source_id INTEGER');

db.exec(`
  CREATE TABLE IF NOT EXISTS recurring_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL,
    category_id INTEGER NOT NULL,
    frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly')),
    start_date TEXT NOT NULL,
    next_run_date TEXT NOT NULL,
    end_date TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS savings_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    target_amount REAL NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id, month)
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const seedDefaults = (userId) => {
  const count = db.prepare('SELECT COUNT(*) as n FROM categories WHERE user_id = ?').get(userId);
  if (count.n > 0) return;

  const insert = db.prepare(`
    INSERT INTO categories (user_id, name, color, icon, budget)
    VALUES (?, ?, ?, ?, ?)
  `);
  const seedMany = db.transaction((items) => {
    items.forEach((item) => insert.run(userId, item.name, item.color, item.icon, item.budget));
  });
  seedMany([
    { name: 'Alimentación', color: '#f97316', icon: '🍔', budget: 400 },
    { name: 'Transporte', color: '#3b82f6', icon: '🚌', budget: 150 },
    { name: 'Entretenimiento', color: '#a855f7', icon: '🎮', budget: 120 },
    { name: 'Salud', color: '#22c55e', icon: '🏥', budget: 100 },
    { name: 'Hogar', color: '#eab308', icon: '🏠', budget: 300 },
    { name: 'Ropa', color: '#ec4899', icon: '👕', budget: 120 },
    { name: 'Educación', color: '#14b8a6', icon: '📚', budget: 80 },
    { name: 'Otros', color: '#6b7280', icon: '📦', budget: 100 },
  ]);
};

seedDefaults(demoUserId);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
  CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
  CREATE INDEX IF NOT EXISTS idx_recurring_user_id ON recurring_expenses(user_id);
  CREATE INDEX IF NOT EXISTS idx_recurring_next_run ON recurring_expenses(next_run_date);
  CREATE INDEX IF NOT EXISTS idx_goal_user_month ON savings_goals(user_id, month);
  CREATE INDEX IF NOT EXISTS idx_reset_user_expires ON password_reset_tokens(user_id, expires_at);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurring_unique
    ON expenses(user_id, recurring_source_id, date)
    WHERE recurring_source_id IS NOT NULL;
`);

db.seedDefaultsForUser = seedDefaults;

module.exports = db;
