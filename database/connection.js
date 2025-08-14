const Database = require('better-sqlite3');
const path = require('path');

// Use in-memory database for Vercel (serverless environment)
const getDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use in-memory database for Vercel
    return ':memory:';
  }
  // Use file-based database for development
  return path.join(__dirname, 'wagehire.db');
};

const dbPath = getDbPath();

class DatabaseConnection {
  constructor() {
    this.db = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.db = new Database(dbPath);
        console.log(`Connected to SQLite database: ${dbPath}`);
        resolve();
      } catch (err) {
        console.error('Error connecting to database:', err);
        reject(err);
      }
    });
  }

  getConnection() {
    if (!this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  close() {
    return new Promise((resolve, reject) => {
      try {
        if (this.db) {
          this.db.close();
          console.log('Database connection closed');
        }
        resolve();
      } catch (err) {
        console.error('Error closing database:', err);
        reject(err);
      }
    });
  }

  // Helper method for running queries
  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const result = stmt.run(params);
        resolve({ id: result.lastInsertRowid, changes: result.changes });
      } catch (err) {
        reject(err);
      }
    });
  }

  // Helper method for getting single row
  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const row = stmt.get(params);
        resolve(row);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Helper method for getting multiple rows
  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      try {
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(params);
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    });
  }
}

// Create singleton instance
const database = new DatabaseConnection();

module.exports = database; 