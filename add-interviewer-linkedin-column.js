const { db } = require('./database/db');

async function addInterviewerLinkedInColumn() {
  return new Promise((resolve, reject) => {
    console.log('Adding interviewer_linkedin_url column to interviews table...');
    
    db.run(`
      ALTER TABLE interviews 
      ADD COLUMN interviewer_linkedin_url TEXT
    `, (err) => {
      if (err) {
        if (err.message.includes('duplicate column name')) {
          console.log('Column interviewer_linkedin_url already exists, skipping...');
          resolve();
        } else {
          console.error('Error adding column:', err);
          reject(err);
        }
      } else {
        console.log('Successfully added interviewer_linkedin_url column to interviews table');
        resolve();
      }
    });
  });
}

// Run the migration
addInterviewerLinkedInColumn()
  .then(() => {
    console.log('Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  }); 