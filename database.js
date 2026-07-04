const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, 'database.db');

let db = null;

function initDatabase() {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        reject(err);
        return;
      }
      console.log('✅ Database connected');
      createTables().then(resolve).catch(reject);
    });
  });
}

function createTables() {
  return new Promise((resolve, reject) => {
    const queries = [
      `CREATE TABLE IF NOT EXISTS chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        pinned INTEGER DEFAULT 0,
        folder TEXT DEFAULT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      )`,

      `CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`,
      `CREATE INDEX IF NOT EXISTS idx_chats_updated_at ON chats(updated_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_chats_pinned ON chats(pinned)`
    ];

    db.serialize(() => {
      let error = null;
      queries.forEach(query => {
        db.run(query, (err) => {
          if (err) error = err;
        });
      });

      if (error) {
        reject(error);
      } else {
        // Insert default settings if not exists
        db.run(
          `INSERT OR IGNORE INTO settings (key, value) VALUES 
            ('model', ?),
            ('temperature', ?),
            ('max_tokens', ?),
            ('top_p', ?),
            ('theme', ?)`,
          [
            process.env.MODEL || 'gpt-4.1-mini',
            process.env.TEMPERATURE || '0.7',
            process.env.MAX_TOKENS || '4096',
            '1.0',
            'dark'
          ],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      }
    });
  });
}

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function closeDatabase() {
  return new Promise((resolve, reject) => {
    if (db) {
      db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    } else {
      resolve();
    }
  });
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase
};