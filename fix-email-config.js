#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function fixEmailConfig() {
  console.log('🔧 Quick Email Configuration Fix\n');
  console.log('This will help you fix the email verification issue for candidates.\n');

  try {
    const envPath = path.join(__dirname, '.env');
    
    // Check if .env exists
    if (!fs.existsSync(envPath)) {
      console.log('❌ .env file not found. Creating one...\n');
    } else {
      console.log('✅ .env file found.\n');
    }

    console.log('📋 Gmail App Password Setup:\n');
    console.log('1. Go to: https://myaccount.google.com/security');
    console.log('2. Enable "2-Step Verification" if not already enabled');
    console.log('3. Go to: https://myaccount.google.com/apppasswords');
    console.log('4. Select "Mail" and "Other"');
    console.log('5. Click "Generate" and copy the 16-character password\n');

    const emailPass = await question('Enter your Gmail App Password (16 characters): ');
    if (!emailPass) {
      console.log('❌ App Password is required. Setup cancelled.');
      rl.close();
      return;
    }

    // Create .env content
    const envContent = `# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (for Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=maaxvman92@gmail.com
EMAIL_PASS=${emailPass}

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Database Reset (set to 'true' to reset database on startup)
RESET_DB=false

# Node Environment
NODE_ENV=development
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Email configuration saved!');
    console.log('📧 EMAIL_USER: maaxvman92@gmail.com');
    console.log('🔐 EMAIL_PASS: [Configured]');
    
    // Test the configuration
    console.log('\n🧪 Testing email configuration...');
    
    require('dotenv').config();
    const { verifyEmailConfig } = require('./services/emailService');
    
    const testResult = await verifyEmailConfig();
    
    if (testResult) {
      console.log('✅ Email configuration is working!');
      console.log('📧 Candidates will now receive verification emails.');
      console.log('\n🚀 Next steps:');
      console.log('1. Restart your backend server: npm start');
      console.log('2. Test registration with a new candidate');
      console.log('3. Check if verification email is received');
    } else {
      console.log('❌ Email configuration failed.');
      console.log('📋 Please check:');
      console.log('   - 2-Factor Authentication is enabled on Gmail');
      console.log('   - App Password is correct (16 characters)');
      console.log('   - Internet connection is working');
      console.log('\n🔄 Manual verification is still available as fallback.');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

fixEmailConfig(); 