#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function externalIPSetup() {
  console.log('🌐 External IP Setup for Manual Verification\n');
  console.log('This will configure the system to work with external IP addresses.\n');

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

    const envPath = path.join(__dirname, '.env');
    
    // Create .env content for external IP with manual verification
    const envContent = `# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here

# Email Configuration (Manual Verification Only)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=manual-verification-only
EMAIL_PASS=manual-verification-only

# Frontend URL (for verification links) - External IP
FRONTEND_URL=${frontendUrl}

# Database Reset (set to 'true' to reset database on startup)
RESET_DB=false

# Node Environment
NODE_ENV=development
`;

    // Write .env file
    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved!');
    console.log(`🌐 Frontend URL: ${frontendUrl}`);
    console.log('📧 System configured for manual verification only');
    console.log('🔗 Verification links will work from external devices');
    
    console.log('\n🚀 How it works:');
    console.log('1. User registers from any device');
    console.log('2. System generates verification link with external IP');
    console.log('3. User clicks the link to verify');
    console.log('4. User can then login');
    
    console.log('\n📋 Next steps:');
    console.log('1. Start backend server: npm start');
    console.log('2. Start frontend with external access:');
    console.log('   cd ../frontend');
    console.log('   set HOST=0.0.0.0 && npm start');
    console.log(`3. Access from any device: ${frontendUrl}`);
    console.log('4. Register a new user to test verification');
    
    console.log('\n🔧 Frontend External Access:');
    console.log('To make frontend accessible from other devices:');
    console.log('1. Open Command Prompt as Administrator');
    console.log('2. Navigate to frontend directory');
    console.log('3. Run: set HOST=0.0.0.0 && npm start');
    console.log('4. Or use the batch file: start-external.bat');
    
    console.log('\n🎉 Setup complete! External IP access configured.');
    
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
  } finally {
    rl.close();
  }
}

externalIPSetup(); 