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

// Get all candidates (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let query = 'SELECT * FROM candidates';
    const params = [];
    const conditions = [];
    
    // If user is not admin, only show their own candidates
    if (req.user.role !== 'admin') {
      conditions.push('user_id = ?');
      params.push(req.user.userId);
    }
    
    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }
    
    if (search) {
      conditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY created_at DESC';
    
    const candidates = await all(query, params);
    
    res.json({ candidates });
    
  } catch (error) {
    console.error('Get candidates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single candidate by ID (with access control)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = 'SELECT * FROM candidates WHERE id = ?';
    const params = [id];
    
    // If user is not admin, check if they own this candidate
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.userId);
    }
    
    const candidate = await get(query, params);
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Get interviews for this candidate
    const interviews = await all(`
      SELECT 
        i.*,
        u.name as interviewer_name,
        u.email as interviewer_email
      FROM interviews i
      JOIN users u ON i.interviewer_id = u.id
      WHERE i.candidate_id = ?
      ORDER BY i.scheduled_date DESC
    `, [id]);
    
    res.json({ 
      candidate: {
        ...candidate,
        interviews
      }
    });
    
  } catch (error) {
    console.error('Get candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new candidate
router.post('/', [
  authenticateToken,
  body('name').trim().isLength({ min: 2 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('resume_url').optional().isURL(),
  body('notes').optional().trim()
], validateRequest, async (req, res) => {
  try {
    const { name, email, phone, resume_url, notes } = req.body;
    
    // Check if candidate already exists
    const existingCandidate = await get(
      'SELECT id FROM candidates WHERE email = ?',
      [email]
    );
    
    if (existingCandidate) {
      return res.status(400).json({ error: 'Candidate with this email already exists' });
    }
    
    // Create candidate with user_id
    const result = await run(`
      INSERT INTO candidates (name, email, phone, resume_url, notes, status, user_id)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `, [name, email, phone, resume_url, notes, req.user.userId]);
    
    // Get the created candidate
    const newCandidate = await get(
      'SELECT * FROM candidates WHERE id = ?',
      [result.id]
    );
    
    res.status(201).json({
      message: 'Candidate added successfully',
      candidate: newCandidate
    });
    
  } catch (error) {
    console.error('Create candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update candidate (with access control)
router.put('/:id', [
  authenticateToken,
  body('name').optional().trim().isLength({ min: 2 }),
  body('email').optional().isEmail().normalizeEmail(),
  body('phone').optional().trim(),
  body('resume_url').optional().isURL(),
  body('status').optional().isIn(['pending', 'interviewing', 'hired', 'rejected']),
  body('notes').optional().trim()
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;
    
    // Check if candidate exists and user has access
    let query = 'SELECT * FROM candidates WHERE id = ?';
    const params = [id];
    
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.userId);
    }
    
    const existingCandidate = await get(query, params);
    
    if (!existingCandidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Check email uniqueness if email is being updated
    if (updateFields.email && updateFields.email !== existingCandidate.email) {
      const emailExists = await get(
        'SELECT id FROM candidates WHERE email = ? AND id != ?',
        [updateFields.email, id]
      );
      
      if (emailExists) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    // Build update query
    const fields = [];
    const values = [];
    
    Object.keys(updateFields).forEach(key => {
      if (updateFields[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(updateFields[key]);
      }
    });
    
    if (fields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);
    
    await run(`
      UPDATE candidates SET ${fields.join(', ')} WHERE id = ?
    `, values);
    
    // Get updated candidate
    const updatedCandidate = await get(
      'SELECT * FROM candidates WHERE id = ?',
      [id]
    );
    
    res.json({
      message: 'Candidate updated successfully',
      candidate: updatedCandidate
    });
    
  } catch (error) {
    console.error('Update candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete candidate (with access control)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if candidate exists and user has access
    let query = 'SELECT * FROM candidates WHERE id = ?';
    const params = [id];
    
    if (req.user.role !== 'admin') {
      query += ' AND user_id = ?';
      params.push(req.user.userId);
    }
    
    const candidate = await get(query, params);
    
    if (!candidate) {
      return res.status(404).json({ error: 'Candidate not found' });
    }
    
    // Check if candidate has interviews
    const interviews = await get(
      'SELECT id FROM interviews WHERE candidate_id = ?',
      [id]
    );
    
    if (interviews) {
      return res.status(400).json({ 
        error: 'Cannot delete candidate with existing interviews. Please delete interviews first.' 
      });
    }
    
    // Delete candidate
    await run('DELETE FROM candidates WHERE id = ?', [id]);
    
    res.json({ message: 'Candidate deleted successfully' });
    
  } catch (error) {
    console.error('Delete candidate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get candidate statistics (filtered by user role)
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    let whereClause = '';
    const params = [];
    
    // If user is not admin, only count their own candidates
    if (req.user.role !== 'admin') {
      whereClause = 'WHERE user_id = ?';
      params.push(req.user.userId);
    }
    
    // Get total candidates
    const totalCandidates = await get(
      `SELECT COUNT(*) as count FROM candidates ${whereClause}`,
      params
    );
    
    // Get candidates by status
    const statusStats = await all(`
      SELECT status, COUNT(*) as count 
      FROM candidates 
      ${whereClause}
      GROUP BY status
    `, params);
    
    // Get recent candidates (last 30 days)
    const recentCandidates = await get(`
      SELECT COUNT(*) as count 
      FROM candidates 
      ${whereClause ? whereClause + ' AND' : 'WHERE'} created_at >= datetime('now', '-30 days')
    `, params);
    
    // Get candidates with interviews
    const candidatesWithInterviews = await get(`
      SELECT COUNT(DISTINCT i.candidate_id) as count 
      FROM interviews i
      JOIN candidates c ON i.candidate_id = c.id
      ${whereClause}
    `, params);
    
    res.json({
      stats: {
        total: totalCandidates.count,
        byStatus: statusStats,
        recent: recentCandidates.count,
        withInterviews: candidatesWithInterviews.count
      }
    });
    
  } catch (error) {
    console.error('Get candidate stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 