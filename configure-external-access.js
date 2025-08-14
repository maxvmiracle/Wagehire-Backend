#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const os = require('os');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function configureExternalAccess() {
  console.log('🌐 External IP Access Configuration for Wagehire\n');
  
  try {
    // Get local IP address
    const interfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    for (const name of Object.keys(interfaces)) {
      for (const interface of interfaces[name]) {
        if (interface.family === 'IPv4' && !interface.internal) {
          localIP = interface.address;
          break;
        }
      }
      if (localIP !== 'localhost') break;
    }

    console.log(`📡 Detected local IP: ${localIP}`);
    console.log(`🌍 To access from another device, use: http://${localIP}:3000\n`);

    // Ask for configuration
    console.log('🔧 Configuration Options:\n');
    
    const useLocalIP = await question(`Use local IP (${localIP}) for external access? (y/N): `);
    
    let frontendUrl;
    if (useLocalIP.toLowerCase() === 'y' || useLocalIP.toLowerCase() === 'yes') {
      frontendUrl = `http://${localIP}:3000`;
    } else {
      const customIP = await question('Enter custom IP address (e.g., 192.168.1.100): ');
      frontendUrl = `http://${customIP}:3000`;
    }

    // Ask for email configuration
    console.log('\n📧 Email Configuration:\n');
    
    const emailUser = await question('Enter your Gmail address: ');
    if (!emailUser) {
      console.log('❌ Email address is required.');
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
      console.log('❌ App Password is required.');
      rl.close();
      return;
    }

    // Create .env content
    const envContent = `# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (for Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=${emailUser}
EMAIL_PASS=${emailPass}

# Frontend URL (for email links)
FRONTEND_URL=${frontendUrl}

# Database Reset (set to 'true' to reset database on startup)
RESET_DB=false

# Node Environment
NODE_ENV=development
`;

    // Write .env file
    const envPath = path.join(__dirname, '.env');
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved!');
    console.log(`🌐 Frontend URL: ${frontendUrl}`);
    console.log(`📧 Email: ${emailUser}`);
    
    // Test the configuration
    console.log('\n🧪 Testing email configuration...');
    
    require('dotenv').config();
    const { verifyEmailConfig } = require('./services/emailService');
    
    const testResult = await verifyEmailConfig();
    
    if (testResult) {
      console.log('✅ Email configuration is working!');
    } else {
      console.log('❌ Email configuration failed.');
      console.log('📋 Please check your Gmail App Password.');
    }
    
    console.log('\n📋 Next Steps:');
    console.log('1. Start the backend server: npm start');
    console.log('2. Start the frontend server: cd ../frontend && npm start');
    console.log(`3. Access the application from another device: ${frontendUrl}`);
    console.log('4. Register a new user to test email verification');
    
    if (testResult) {
      console.log('✅ Email verification will work from any device!');
    } else {
      console.log('⚠️  Email verification may not work, but manual verification will be available.');
    }
    
  } catch (error) {
    console.error('❌ Configuration failed:', error.message);
  } finally {
    rl.close();
  }
}

configureExternalAccess(); 