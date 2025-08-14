const nodemailer = require('nodemailer');
const crypto = require('crypto');

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: process.env.EMAIL_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.EMAIL_PASS || 'your-app-password'
  }
};

// Check if email credentials are properly configured
const isEmailConfigured = () => {
  const hasUser = process.env.EMAIL_USER && 
                  process.env.EMAIL_USER !== 'your-email@gmail.com' && 
                  process.env.EMAIL_USER !== '' &&
                  process.env.EMAIL_USER !== 'manual-verification-only';
  const hasPass = process.env.EMAIL_PASS && 
                  process.env.EMAIL_PASS !== 'your-app-password' && 
                  process.env.EMAIL_PASS !== '' &&
                  process.env.EMAIL_PASS !== 'manual-verification-only';
  
  if (!hasUser) {
    console.log('⚠️  EMAIL_USER not configured or using manual verification mode');
  }
  if (!hasPass) {
    console.log('⚠️  EMAIL_PASS not configured or using manual verification mode');
  }
  
  return hasUser && hasPass;
};

// Create transporter only if email is configured
let transporter = null;
if (isEmailConfigured()) {
  try {
    console.log('📧 Creating email transporter...');
    console.log(`📧 Email host: ${emailConfig.host}:${emailConfig.port}`);
    console.log(`📧 Email user: ${emailConfig.auth.user}`);
    
    transporter = nodemailer.createTransport(emailConfig);
    console.log('✅ Email transporter created successfully');
  } catch (error) {
    console.error('❌ Failed to create email transporter:', error);
  }
} else {
  console.log('📧 Manual verification mode enabled - no email sending');
  console.log('🔗 Verification links will be displayed directly to users');
  console.log('📋 To enable email sending:');
  console.log('   1. Run: npm run quick-email-setup');
  console.log('   2. Or set EMAIL_USER and EMAIL_PASS in .env file');
}

// Generate verification token
const generateVerificationToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Generate password reset token
const generatePasswordResetToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

// Send verification email
const sendVerificationEmail = async (email, name, token, baseUrl) => {
  const verificationUrl = `${baseUrl}/verify-email?token=${token}`;
  
  // Check if email is configured
  if (!isEmailConfigured() || !transporter) {
    console.log('📧 Email not configured. Using manual verification.');
    console.log(`📧 Verification URL for ${email}: ${verificationUrl}`);
    console.log('📋 User should click the verification link to confirm their account');
    
    return {
      success: false,
      reason: 'email_not_configured',
      manualUrl: verificationUrl,
      message: 'Please use the verification link below to confirm your account'
    };
  }
  
  const mailOptions = {
    from: `"Wagehire" <${emailConfig.auth.user}>`,
    to: email,
    subject: 'Verify Your Email - Wagehire',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px; color: white;">Wagehire</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9; color: white;">Interview Management Platform</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Welcome to Wagehire, ${name}!</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            Thank you for registering with Wagehire. To complete your registration and start managing your interview journey, 
            please verify your email address by clicking the button below.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
              Verify Email Address
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
            If the button doesn't work, you can copy and paste this link into your browser:
          </p>
          
          <p style="background: #e9ecef; padding: 15px; border-radius: 5px; word-break: break-all; color: #495057;">
            ${verificationUrl}
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-top: 25px;">
            This verification link will expire in 24 hours. If you didn't create an account with Wagehire, 
            you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          
          <p style="color: #999; font-size: 14px; text-align: center;">
            Best regards,<br>
            The Wagehire Team
          </p>
        </div>
      </div>
    `
  };

  try {
    console.log(`📧 Sending verification email to: ${email}`);
    console.log(`🔗 Verification URL: ${verificationUrl}`);
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent successfully to ${email}`);
    console.log(`📨 Message ID: ${result.messageId}`);
    return {
      success: true,
      messageId: result.messageId
    };
  } catch (error) {
    console.error('❌ Email sending error:', error);
    console.error('📧 Email details:', {
      to: email,
      from: emailConfig.auth.user,
      host: emailConfig.host,
      port: emailConfig.port
    });
    
    // Provide specific error messages for common issues
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Please check your EMAIL_USER and EMAIL_PASS.');
    } else if (error.code === 'ECONNECTION') {
      console.error('🌐 Connection failed. Please check your EMAIL_HOST and EMAIL_PORT.');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('⏰ Connection timed out. Please check your internet connection.');
    }
    
    return {
      success: false,
      reason: 'email_send_failed',
      error: error.message,
      manualUrl: verificationUrl
    };
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, name, token, baseUrl) => {
  // Check if email is configured
  if (!isEmailConfigured() || !transporter) {
    console.log('Email not configured. Reset URL:', `${baseUrl}/reset-password?token=${token}`);
    return false;
  }

  const resetUrl = `${baseUrl}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"Wagehire" <${emailConfig.auth.user}>`,
    to: email,
    subject: 'Reset Your Password - Wagehire',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 28px;">Wagehire</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Interview Management Platform</p>
        </div>
        
        <div style="padding: 30px; background: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Password Reset Request</h2>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
            Hello ${name},<br><br>
            We received a request to reset your password for your Wagehire account. 
            Click the button below to create a new password.
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 8px; 
                      display: inline-block; 
                      font-weight: bold;
                      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; line-height: 1.6; margin-bottom: 15px;">
            If the button doesn't work, you can copy and paste this link into your browser:
          </p>
          
          <p style="background: #e9ecef; padding: 15px; border-radius: 5px; word-break: break-all; color: #495057;">
            ${resetUrl}
          </p>
          
          <p style="color: #666; line-height: 1.6; margin-top: 25px;">
            This password reset link will expire in 1 hour. If you didn't request a password reset, 
            you can safely ignore this email and your password will remain unchanged.
          </p>
          
          <hr style="border: none; border-top: 1px solid #dee2e6; margin: 30px 0;">
          
          <p style="color: #999; font-size: 14px; text-align: center;">
            Best regards,<br>
            The Wagehire Team
          </p>
        </div>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Email sending error:', error);
    return false;
  }
};

// Verify email configuration
const verifyEmailConfig = async () => {
  console.log('🔍 Verifying email configuration...');
  
  if (!isEmailConfigured()) {
    console.log('📧 Manual verification mode enabled - no email sending required');
    console.log('🔗 Verification links will be displayed directly to users');
    console.log('📋 To enable email sending, set EMAIL_USER and EMAIL_PASS in .env file');
    return false;
  }

  if (!transporter) {
    console.log('❌ Email transporter not available.');
    return false;
  }

  try {
    console.log('🔍 Testing email connection...');
    await transporter.verify();
    console.log('✅ Email service is ready and working');
    return true;
  } catch (error) {
    console.error('❌ Email service configuration error:', error);
    
    // Provide specific guidance based on error type
    if (error.code === 'EAUTH') {
      console.error('🔐 Authentication failed. Please check:');
      console.error('   - EMAIL_USER is correct');
      console.error('   - EMAIL_PASS is correct (use app password for Gmail)');
      console.error('   - 2-factor authentication is enabled for Gmail');
    } else if (error.code === 'ECONNECTION') {
      console.error('🌐 Connection failed. Please check:');
      console.error('   - EMAIL_HOST is correct (smtp.gmail.com for Gmail)');
      console.error('   - EMAIL_PORT is correct (587 for Gmail)');
      console.error('   - Internet connection is working');
    }
    
    return false;
  }
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  generateVerificationToken,
  generatePasswordResetToken,
  verifyEmailConfig,
  isEmailConfigured
}; 