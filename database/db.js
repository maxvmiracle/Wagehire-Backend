const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Use the same database path logic as connection.js
const getDbPath = () => {
  if (process.env.NODE_ENV === 'production') {
    // Use in-memory database for Vercel
    return ':memory:';
  }
  // Use file-based database for development
  return path.join(__dirname, 'wagehire.db');
};

const dbPath = getDbPath();

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err);
  } else {
    console.log(`Connected to SQLite database: ${dbPath}`);
  }
});

// Initialize database tables
const initializeTables = () => {
  return new Promise((resolve, reject) => {
    console.log('Initializing database tables...');
    
    db.serialize(() => {
      // Create users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'candidate',
          phone TEXT,
          resume_url TEXT,
          current_position TEXT,
          experience_years INTEGER,
          skills TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error creating users table:', err);
          reject(err);
          return;
        }
        console.log('Users table created/verified');
      });

      // Create interviews table
      db.run(`
        CREATE TABLE IF NOT EXISTS interviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          company_name TEXT NOT NULL,
          job_title TEXT NOT NULL,
          scheduled_date DATETIME,
          duration INTEGER DEFAULT 60,
          status TEXT DEFAULT 'scheduled',
          round INTEGER DEFAULT 1,
          location TEXT,
          notes TEXT,
          company_website TEXT,
          company_linkedin_url TEXT,
          other_urls TEXT,
          job_description TEXT,
          salary_range TEXT,
          interviewer_name TEXT,
          interviewer_email TEXT,
          interviewer_position TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating interviews table:', err);
          reject(err);
          return;
        }
        console.log('Interviews table created/verified');
      });

      // Create candidates table
      db.run(`
        CREATE TABLE IF NOT EXISTS candidates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          phone TEXT,
          resume_url TEXT,
          notes TEXT,
          status TEXT DEFAULT 'pending',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating candidates table:', err);
          reject(err);
          return;
        }
        console.log('Candidates table created/verified');
      });

      // Create interview_feedback table
      db.run(`
        CREATE TABLE IF NOT EXISTS interview_feedback (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          interview_id INTEGER NOT NULL,
          candidate_id INTEGER NOT NULL,
          technical_skills INTEGER,
          communication_skills INTEGER,
          problem_solving INTEGER,
          cultural_fit INTEGER,
          overall_rating INTEGER,
          feedback_text TEXT,
          recommendation TEXT,
          received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (interview_id) REFERENCES interviews (id),
          FOREIGN KEY (candidate_id) REFERENCES users (id)
        )
      `, (err) => {
        if (err) {
          console.error('Error creating interview_feedback table:', err);
          reject(err);
          return;
        }
        console.log('Interview feedback table created/verified');
        console.log('Database initialization completed');
        resolve();
      });
    });
  });
};

// Initialize tables immediately
let tablesInitialized = false;
initializeTables()
  .then(() => {
    tablesInitialized = true;
    console.log('Database tables ready');
  })
  .catch((err) => {
    console.error('Failed to initialize database tables:', err);
  });

// Helper functions with table initialization check
const ensureTablesInitialized = async () => {
  if (!tablesInitialized) {
    await initializeTables();
    tablesInitialized = true;
  }
};

const run = async (sql, params = []) => {
  await ensureTablesInitialized();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

const get = async (sql, params = []) => {
  await ensureTablesInitialized();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const all = async (sql, params = []) => {
  await ensureTablesInitialized();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

module.exports = {
  db,
  run,
  get,
  all,
  initializeTables
}; 