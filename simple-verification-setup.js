#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function simpleVerificationSetup() {
  console.log('🔧 Simple Verification Setup\n');
  console.log('This will configure the system for manual verification without email sending.\n');

  try {
    const envPath = path.join(__dirname, '.env');
    
    // Create .env content for manual verification only
    const envContent = `# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (Manual Verification Only)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=manual-verification-only
EMAIL_PASS=manual-verification-only

# Frontend URL (for verification links)
FRONTEND_URL=http://localhost:3000

# Database Reset (set to 'true' to reset database on startup)
RESET_DB=false

# Node Environment
NODE_ENV=development
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ Configuration saved!');
    console.log('📧 System configured for manual verification only');
    console.log('🔗 Verification links will be displayed directly to users');
    console.log('📋 No email sending required');
    
    console.log('\n🚀 How it works:');
    console.log('1. User registers');
    console.log('2. System generates verification link');
    console.log('3. User clicks the link to verify');
    console.log('4. User can then login');
    
    console.log('\n📋 Next steps:');
    console.log('1. Restart your backend server: npm start');
    console.log('2. Test registration with a new user');
    console.log('3. User will see verification link directly');
    console.log('4. User clicks link to verify account');
    
    console.log('\n🎉 Setup complete! No Gmail App Password needed.');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  }
}

simpleVerificationSetup(); 