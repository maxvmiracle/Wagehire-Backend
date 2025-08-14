#!/usr/bin/env node

require('dotenv').config();
const { verifyEmailConfig, sendVerificationEmail } = require('./services/emailService');

async function testEmail() {
  console.log('🧪 Testing Email Configuration\n');
  
  // Test 1: Check if email is configured
  console.log('1. Checking email configuration...');
  const isConfigured = await verifyEmailConfig();
  
  if (!isConfigured) {
    console.log('❌ Email is not properly configured.');
    console.log('📋 Please run: npm run setup-email');
    process.exit(1);
  }
  
  console.log('✅ Email configuration is working!\n');
  
  // Test 2: Test sending a verification email
  console.log('2. Testing verification email...');
  
  const testEmail = process.env.TEST_EMAIL || 'test@example.com';
  const testName = 'Test User';
  const testToken = 'test-token-123';
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  console.log(`📧 Sending test email to: ${testEmail}`);
  
  const result = await sendVerificationEmail(testEmail, testName, testToken, baseUrl);
  
  if (result.success) {
    console.log('✅ Test email sent successfully!');
    console.log(`📨 Message ID: ${result.messageId}`);
  } else {
    console.log('❌ Test email failed to send.');
    console.log(`🔍 Reason: ${result.reason}`);
    if (result.error) {
      console.log(`📝 Error: ${result.error}`);
    }
    if (result.manualUrl) {
      console.log(`🔗 Manual verification URL: ${result.manualUrl}`);
    }
  }
  
  console.log('\n🎉 Email testing completed!');
}

testEmail().catch(console.error); 