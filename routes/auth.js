const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../database/db');
const { 
  sendVerificationEmail, 
  sendPasswordResetEmail, 
  generateVerificationToken, 
  generatePasswordResetToken 
} = require('../services/emailService');

// Strong password validation function
const validateStrongPassword = (password) => {
  const errors = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

const router = express.Router();

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      error: errors.array()[0].msg,
      errors: errors.array() 
    });
  }
  next();
};

// Login route
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user from database
    const user = await get(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Email verification is disabled - all users can login immediately
    // if (user.role !== 'admin' && !user.email_verified) {
    //   return res.status(401).json({ 
    //     error: 'Please verify your email address before logging in',
    //     emailNotVerified: true 
    //   });
    // }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Register route for candidates
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
  body('name').trim().isLength({ min: 2 }),
  body('phone').optional().trim(),
  body('resume_url').optional().isURL(),
  body('current_position').optional().trim(),
  body('experience_years').optional().isInt({ min: 0, max: 50 }).withMessage('Experience years must be a number between 0 and 50'),
  body('skills').optional().trim()
], validateRequest, async (req, res) => {
  try {
    const { 
      email, 
      password, 
      name, 
      phone, 
      resume_url, 
      current_position, 
      experience_years, 
      skills 
    } = req.body;

    // Check if user already exists
    const existingUser = await get(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Validate strong password
    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: passwordValidation.errors,
        passwordRequirements: [
          'At least 8 characters long',
          'At least one uppercase letter (A-Z)',
          'At least one lowercase letter (a-z)',
          'At least one number (0-9)',
          'At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'
        ]
      });
    }

    // Check if this is the first user
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    const isFirstUser = userCount.count === 0;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // If this is the first user, make them an admin, otherwise make them a candidate
    const userRole = isFirstUser ? 'admin' : 'candidate';

    // All users are automatically verified - no email verification required
    const result = await run(
      'INSERT INTO users (email, password, name, role, phone, resume_url, current_position, experience_years, skills, email_verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)',
      [email, hashedPassword, name, userRole, phone, resume_url, current_position, experience_years, skills]
    );

    // Get the created user
    const newUser = await get(
      'SELECT id, email, name, role, phone, resume_url, current_position, experience_years, skills, email_verified, created_at FROM users WHERE id = ?',
      [result.id]
    );

    res.status(201).json({
      message: isFirstUser ? 'Admin account created successfully! You can now login.' : 'Registration successful! You can now login.',
      user: newUser,
      emailVerificationSent: false,
      requiresVerification: false,
      isAdmin: isFirstUser
    });

  } catch (error) {
    console.error('Registration error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Email verification route
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user with this verification token
    const user = await get(
      'SELECT id, email, name, email_verification_expires FROM users WHERE email_verification_token = ?',
      [token]
    );

    if (!user) {
      return res.status(400).json({ error: 'Invalid verification token' });
    }

    // Check if token has expired
    if (new Date() > new Date(user.email_verification_expires)) {
      return res.status(400).json({ error: 'Verification token has expired' });
    }

    // Mark email as verified and clear token
    await run(
      'UPDATE users SET email_verified = 1, email_verification_token = NULL, email_verification_expires = NULL WHERE id = ?',
      [user.id]
    );

    res.json({
      message: 'Email verified successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Resend verification email
router.post('/resend-verification', [
  body('email').isEmail().normalizeEmail()
], validateRequest, async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await get(
      'SELECT id, email, name, email_verified, email_verification_token FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    // Generate new verification token
    const verificationToken = generateVerificationToken();
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await run(
      'UPDATE users SET email_verification_token = ?, email_verification_expires = ? WHERE id = ?',
      [verificationToken, verificationExpires, user.id]
    );

    // Send verification email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const emailResult = await sendVerificationEmail(email, user.name, verificationToken, baseUrl);

    // Handle response based on email configuration
    if (emailResult.success) {
      res.json({
        message: 'Verification email sent successfully! Please check your email.',
        emailSent: true,
        manualVerification: false
      });
    } else {
      res.json({
        message: 'Please use the verification link below to confirm your account.',
        emailSent: false,
        manualVerification: true,
        verificationToken: verificationToken,
        verificationUrl: emailResult.manualUrl,
        verificationMessage: emailResult.message
      });
    }

  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get manual verification token for a user (for development/testing)
router.get('/manual-verification/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Find user
    const user = await get(
      'SELECT id, email, name, email_verified, email_verification_token, email_verification_expires FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.email_verified) {
      return res.status(400).json({ error: 'Email is already verified' });
    }

    if (!user.email_verification_token) {
      return res.status(400).json({ error: 'No verification token found. Please try registering again.' });
    }

    // Check if token has expired
    if (new Date() > new Date(user.email_verification_expires)) {
      return res.status(400).json({ error: 'Verification token has expired. Please try resending verification email.' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/verify-email?token=${user.email_verification_token}`;

    res.json({
      message: 'Manual verification token retrieved successfully',
      email: user.email,
      name: user.name,
      verificationToken: user.email_verification_token,
      verificationUrl: verificationUrl,
      expiresAt: user.email_verification_expires
    });

  } catch (error) {
    console.error('Manual verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Forgot password route
router.post('/forgot-password', [
  body('email').isEmail().normalizeEmail()
], validateRequest, async (req, res) => {
  try {
    const { email } = req.body;

    // Find user
    const user = await get(
      'SELECT id, email, name FROM users WHERE email = ?',
      [email]
    );

    if (!user) {
      // Don't reveal if user exists or not
      return res.json({ message: 'If an account with that email exists, a password reset link has been sent' });
    }

    // Generate password reset token
    const resetToken = generatePasswordResetToken();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Update user with reset token
    await run(
      'UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE id = ?',
      [resetToken, resetExpires, user.id]
    );

    // Send password reset email
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const emailSent = await sendPasswordResetEmail(email, user.name, resetToken, baseUrl);

    res.json({
      message: emailSent ? 'Password reset email sent successfully' : 'Failed to send password reset email',
      emailSent
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password route
router.post('/reset-password', [
  body('token').notEmpty(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
], validateRequest, async (req, res) => {
  try {
    const { token, password } = req.body;

    // Validate strong password
    const passwordValidation = validateStrongPassword(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({ 
        error: 'Password does not meet security requirements',
        passwordErrors: passwordValidation.errors,
        passwordRequirements: [
          'At least 8 characters long',
          'At least one uppercase letter (A-Z)',
          'At least one lowercase letter (a-z)',
          'At least one number (0-9)',
          'At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)'
        ]
      });
    }

    // Find user with this reset token
    const user = await get(
      'SELECT id, email, password_reset_expires FROM users WHERE password_reset_token = ?',
      [token]
    );

    if (!user) {
      return res.status(400).json({ error: 'Invalid reset token' });
    }

    // Check if token has expired
    if (new Date() > new Date(user.password_reset_expires)) {
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password and clear reset token
    await run(
      'UPDATE users SET password = ?, password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [hashedPassword, user.id]
    );

    res.json({
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user profile
router.get('/profile', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get(
      'SELECT id, email, name, role, phone, resume_url, current_position, experience_years, skills, email_verified, created_at FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });

  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Protected route example
router.get('/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

module.exports = { router, authenticateToken, requireAdmin }; 