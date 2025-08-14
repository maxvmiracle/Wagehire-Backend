const express = require('express');
const { body, validationResult } = require('express-validator');
const { run, get, all } = require('../database/db');
const { authenticateToken, requireAdmin } = require('./auth');

const router = express.Router();

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

// Get all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { role, search } = req.query;
    
    let query = 'SELECT id, email, name, role, phone, current_position, experience_years, skills, created_at FROM users';
    const params = [];
    const conditions = [];
    
    if (role) {
      conditions.push('role = ?');
      params.push(role);
    }
    
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ? OR current_position LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY name ASC';
    
    const users = await all(query, params);
    
    res.json({ users });
    
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single user by ID (admin only)
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await get(
      'SELECT id, email, name, role, phone, resume_url, current_position, experience_years, skills, created_at FROM users WHERE id = ?',
      [id]
    );
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get interviews for this candidate
    const interviews = await all(`
      SELECT 
        i.*,
        u.name as candidate_name,
        u.email as candidate_email
      FROM interviews i
      JOIN users u ON i.candidate_id = u.id
      WHERE i.candidate_id = ?
      ORDER BY i.scheduled_date DESC
    `, [id]);
    
    res.json({ 
      user: {
        ...user,
        interviews
      }
    });
    
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's interviews
router.get('/me/interviews', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT 
        i.*,
        u.name as candidate_name,
        u.email as candidate_email,
        u.phone as candidate_phone
      FROM interviews i
      JOIN users u ON i.candidate_id = u.id
      WHERE i.candidate_id = ?
    `;
    
    const params = [req.user.userId];
    
    if (status) {
      query += ' AND i.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY i.scheduled_date DESC';
    
    const interviews = await all(query, params);
    
    res.json({ interviews });
    
  } catch (error) {
    console.error('Get user interviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user's dashboard stats
router.get('/me/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get total interviews conducted
    const totalInterviews = await get(`
      SELECT COUNT(*) as count 
      FROM interviews 
      WHERE candidate_id = ?
    `, [req.user.userId]);
    
    // Get interviews by status
    const interviewsByStatus = await all(`
      SELECT status, COUNT(*) as count 
      FROM interviews 
      WHERE candidate_id = ?
      GROUP BY status
    `, [req.user.userId]);
    
    // Get upcoming interviews (next 7 days)
    const upcomingInterviews = await get(`
      SELECT COUNT(*) as count 
      FROM interviews 
      WHERE candidate_id = ? 
      AND scheduled_date BETWEEN datetime('now') AND datetime('now', '+7 days')
      AND status = 'scheduled'
    `, [req.user.userId]);
    
    // Get today's interviews
    const todaysInterviews = await get(`
      SELECT COUNT(*) as count 
      FROM interviews 
      WHERE candidate_id = ? 
      AND date(scheduled_date) = date('now')
      AND status = 'scheduled'
    `, [req.user.userId]);
    
    // Get recent feedback received
    const recentFeedback = await get(`
      SELECT COUNT(*) as count 
      FROM interview_feedback 
      WHERE candidate_id = ? 
      AND received_at >= datetime('now', '-7 days')
    `, [req.user.userId]);
    
    // Get profile completion percentage
    const user = await get(`
      SELECT name, email, phone, resume_url, current_position, experience_years, skills 
      FROM users WHERE id = ?
    `, [req.user.userId]);
    
    // Calculate profile completion (same logic as frontend)
    const profileFields = [
      { value: user.name, required: true },
      { value: user.email, required: true },
      { value: user.phone, required: false },
      { value: user.resume_url, required: false },
      { value: user.current_position, required: false },
      { value: user.experience_years, required: false },
      { value: user.skills, required: false }
    ];
    
    let completedFields = 0;
    let totalFields = 0;
    
    profileFields.forEach(field => {
      totalFields++;
      
      if (field.required) {
        // Required fields must have a value
        if (field.value && (typeof field.value === 'string' ? field.value.trim() !== '' : field.value !== null && field.value !== undefined)) {
          completedFields++;
        }
      } else {
        // Optional fields - count if they have a meaningful value
        if (field.value) {
          if (typeof field.value === 'string' && field.value.trim() !== '') {
            completedFields++;
          } else if (typeof field.value === 'number' && field.value > 0) {
            completedFields++;
          }
        }
      }
    });
    
    const profileCompletion = Math.round((completedFields / totalFields) * 100);
    
    res.json({
      stats: {
        totalInterviews: totalInterviews.count,
        byStatus: interviewsByStatus,
        upcoming: upcomingInterviews.count,
        today: todaysInterviews.count,
        recentFeedback: recentFeedback.count,
        profileCompletion
      }
    });
    
  } catch (error) {
    console.error('Get user dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user profile (own profile only)
router.put('/me', [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 1 }).withMessage('Name must be at least 1 character long'),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim().isLength({ min: 0 }),
  body('resume_url').optional().trim().custom((value) => {
    if (value && value.trim() !== '') {
      try {
        new URL(value);
        return true;
      } catch {
        throw new Error('Resume URL must be a valid URL');
      }
    }
    return true;
  }),
  body('current_position').optional().trim(),
  body('experience_years').optional().custom((value) => {
    if (value !== undefined && value !== null && value !== '') {
      const num = parseInt(value);
      if (isNaN(num) || num < 0 || num > 50) {
        throw new Error('Experience years must be a number between 0 and 50');
      }
      return num;
    }
    return value;
  }),
  body('skills').optional().trim()
], validateRequest, async (req, res) => {
  try {
    console.log('Profile update request body:', req.body);
    const { name, email, phone, resume_url, current_position, experience_years, skills } = req.body;
    const updateFields = {};
    
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;
    if (phone) updateFields.phone = phone;
    if (resume_url) updateFields.resume_url = resume_url;
    if (current_position) updateFields.current_position = current_position;
    if (experience_years !== undefined) updateFields.experience_years = experience_years;
    if (skills) updateFields.skills = skills;
    
    console.log('Update fields:', updateFields);
    
    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Check email uniqueness if email is being updated
    if (email) {
      const emailExists = await get(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, req.user.userId]
      );
      
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    // Build update query
    const fields = [];
    const values = [];
    
    Object.keys(updateFields).forEach(key => {
      fields.push(`${key} = ?`);
      values.push(updateFields[key]);
    });
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.user.userId);
    
    await run(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `, values);
    
    // Get updated user
    const updatedUser = await get(
      'SELECT id, email, name, role, phone, resume_url, current_position, experience_years, skills, created_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
    
  } catch (error) {
    console.error('Update user profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 