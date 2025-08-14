#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

async function updateIP() {
  console.log('🌐 Updating IP Address Configuration\n');
  console.log('This will update the system to use IP: 172.86.90.139\n');

  try {
    const envPath = path.join(__dirname, '.env');
    
    // Create .env content with new IP
    const envContent = `# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (Manual Verification Only)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=manual-verification-only
EMAIL_PASS=manual-verification-only

# Frontend URL (for verification links) - External IP
FRONTEND_URL=http://172.86.90.139:3000

# Database Reset (set to 'true' to reset database on startup)
RESET_DB=false

# Node Environment
NODE_ENV=development
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('✅ IP Address Updated!');
    console.log('🌐 New Frontend URL: http://172.86.90.139:3000');
    console.log('🔗 Verification links will now use the new IP address');
    
    console.log('\n📋 Next steps:');
    console.log('1. Restart your backend server: npm start');
    console.log('2. Restart your frontend server: cd ../frontend && set HOST=0.0.0.0 && npm start');
    console.log('3. Access from any device: http://172.86.90.139:3000');
    console.log('4. Test registration and verification');
    
    console.log('\n🎉 IP address updated successfully!');
    
  } catch (error) {
    console.error('❌ Update failed:', error.message);
  }
}

updateIP(); 