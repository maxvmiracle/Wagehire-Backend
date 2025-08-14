const fs = require('fs');
const path = require('path');
const initDatabase = require('./database/init');

async function resetDatabase() {
  try {
    console.log('Setting up fresh database...');
    
    // Set environment variable to force database reset
    process.env.RESET_DB = 'true';
    
    // Initialize the database with new schema (this will drop and recreate tables)
    await initDatabase();
    console.log('Database reset completed successfully');
  } catch (error) {
    console.error('Database reset failed:', error);
    process.exit(1);
  }
}

resetDatabase(); 