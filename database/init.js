const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

async function initDatabase() {
  return new Promise((resolve, reject) => {
    try {
      console.log('Starting database initialization...');
      
      // Only drop tables if explicitly requested (for development/testing)
      // In production, we want to preserve data
      if (process.env.RESET_DB === 'true') {
        console.log('Resetting database tables...');
        db.prepare('DROP TABLE IF EXISTS interview_feedback').run();
        db.prepare('DROP TABLE IF EXISTS interviews').run();
        db.prepare('DROP TABLE IF EXISTS candidates').run();
        db.prepare('DROP TABLE IF EXISTS users').run();
      }

      // Create users table (candidates) with updated role system
      db.prepare(`
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
          email_verified BOOLEAN DEFAULT 0,
          email_verification_token TEXT,
          email_verification_expires DATETIME,
          password_reset_token TEXT,
          password_reset_expires DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();

      // Create interviews table for candidate's interview schedules
      db.prepare(`
        CREATE TABLE IF NOT EXISTS interviews (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          candidate_id INTEGER NOT NULL,
          company_name TEXT NOT NULL,
          job_title TEXT NOT NULL,
          scheduled_date DATETIME,
          duration INTEGER DEFAULT 60,
          status TEXT DEFAULT 'scheduled',
          round INTEGER DEFAULT 1,
          interview_type TEXT DEFAULT 'technical',
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
          interviewer_linkedin_url TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (candidate_id) REFERENCES users (id)
        )
      `).run();

      // Create candidates table
      db.prepare(`
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
      `).run();

      // Create interview_feedback table for candidate's interview feedback
      db.prepare(`
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
      `).run();

      console.log('Database tables created successfully');
      console.log('Database is ready for first user registration');
      resolve();
    } catch (err) {
      console.error('Database error:', err);
      reject(err);
    }
  });
}

module.exports = initDatabase;

// If this file is run directly, initialize the database
if (require.main === module) {
  initDatabase()
    .then(() => {
      console.log('Database initialization completed successfully');
      console.log('No sample data created - first user will be admin');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
} 