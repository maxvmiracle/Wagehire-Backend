#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function quickEmailSetup() {
  console.log('📧 Quick Email Setup for Wagehire\n');
  console.log('This will help you configure email verification.\n');

  try {
    // Check current .env
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Ask for email configuration
    console.log('🔧 Email Configuration\n');
    
    const emailUser = await question('Enter your Gmail address: ');
    if (!emailUser) {
      console.log('❌ Email address is required. Setup cancelled.');
      rl.close();
      return;
    }

    console.log('\n📋 Gmail App Password Setup:\n');
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
    const newEnvContent = `# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (for Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=${emailUser}
EMAIL_PASS=${emailPass}

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000

# Database Reset (set to 'true' to reset database on startup)
RESET_DB=false

# Node Environment
NODE_ENV=development
`;

    // Write .env file
    fs.writeFileSync(envPath, newEnvContent);
    
    console.log('\n✅ Email configuration saved!');
    
    // Test the configuration
    console.log('\n🧪 Testing email configuration...');
    
    require('dotenv').config();
    const { verifyEmailConfig } = require('./services/emailService');
    
    const testResult = await verifyEmailConfig();
    
    if (testResult) {
      console.log('✅ Email configuration is working!');
      console.log('📧 You can now register users and they will receive verification emails.');
    } else {
      console.log('❌ Email configuration failed.');
      console.log('📋 Please check:');
      console.log('   - 2-Factor Authentication is enabled on your Gmail');
      console.log('   - App Password is correct');
      console.log('   - Internet connection is working');
    }
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

quickEmailSetup(); 