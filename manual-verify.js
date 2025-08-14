#!/usr/bin/env node

const { get, run } = require('./database/db');

async function manualVerify() {
  console.log('🔧 Manual Verification Helper\n');
  console.log('This will help you manually verify candidates when email fails.\n');

  try {
    // Get all unverified users
    const unverifiedUsers = await get(`
      SELECT id, email, name, role, email_verification_token, email_verification_expires 
      FROM users 
      WHERE email_verified = 0 AND email_verification_token IS NOT NULL
      ORDER BY created_at DESC
    `);

    if (!unverifiedUsers || unverifiedUsers.length === 0) {
      console.log('✅ No unverified users found.');
      return;
    }

    console.log(`📋 Found ${unverifiedUsers.length} unverified user(s):\n`);

    unverifiedUsers.forEach((user, index) => {
      const expires = new Date(user.email_verification_expires);
      const isExpired = new Date() > expires;
      
      console.log(`${index + 1}. ${user.name} (${user.email})`);
      console.log(`   Role: ${user.role}`);
      console.log(`   Token expires: ${expires.toLocaleString()}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ VALID'}`);
      
      if (!isExpired) {
        const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        const verificationUrl = `${baseUrl}/verify-email?token=${user.email_verification_token}`;
        console.log(`   Manual verification URL: ${verificationUrl}`);
      }
      console.log('');
    });

    // Ask if user wants to verify someone
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const question = (query) => new Promise((resolve) => rl.question(query, resolve));

    const choice = await question('Enter the number of the user to verify (or press Enter to skip): ');
    rl.close();

    if (choice && !isNaN(choice) && choice > 0 && choice <= unverifiedUsers.length) {
      const selectedUser = unverifiedUsers[choice - 1];
      const expires = new Date(selectedUser.email_verification_expires);
      
      if (new Date() > expires) {
        console.log('❌ This verification token has expired.');
        console.log('📧 Please resend verification email or register again.');
        return;
      }

      // Mark as verified
      await run(
        'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
        [selectedUser.id]
      );

      console.log(`✅ Successfully verified ${selectedUser.name} (${selectedUser.email})`);
      console.log('🔓 They can now login to the system.');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

manualVerify(); 