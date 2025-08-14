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

// Get all interviews (filtered by user role)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { status, company_name, job_title } = req.query;
    
    let query = `
      SELECT 
        i.*,
        u.name as candidate_name,
        u.email as candidate_email
      FROM interviews i
      JOIN users u ON i.candidate_id = u.id
    `;
    
    const params = [];
    const conditions = [];
    
    // If user is not admin, only show their own interviews
    if (req.user.role !== 'admin') {
      conditions.push('i.candidate_id = ?');
      params.push(req.user.userId);
    }
    
    if (status) {
      conditions.push('i.status = ?');
      params.push(status);
    }
    
    if (company_name) {
      conditions.push('i.company_name LIKE ?');
      params.push(`%${company_name}%`);
    }
    
    if (job_title) {
      conditions.push('i.job_title LIKE ?');
      params.push(`%${job_title}%`);
    }
    
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    
    query += ' ORDER BY i.scheduled_date DESC';
    
    const interviews = await all(query, params);
    
    res.json({ interviews });
    
  } catch (error) {
    console.error('Get interviews error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single interview by ID (with access control)
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    let query = `
      SELECT 
        i.*,
        u.name as candidate_name,
        u.email as candidate_email,
        u.phone as candidate_phone,
        u.resume_url as candidate_resume
      FROM interviews i
      JOIN users u ON i.candidate_id = u.id
      WHERE i.id = ?
    `;
    const params = [id];
    
    // If user is not admin, check if they own this interview
    if (req.user.role !== 'admin') {
      query += ' AND i.candidate_id = ?';
      params.push(req.user.userId);
    }
    
    const interview = await get(query, params);
    
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    // Get feedback if exists
    const feedback = await get(`
      SELECT * FROM interview_feedback WHERE interview_id = ?
    `, [id]);
    
    res.json({ 
      interview: {
        ...interview,
        feedback
      }
    });
    
  } catch (error) {
    console.error('Get interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create new interview (candidate schedules their own interview)
router.post('/', [
  authenticateToken,
  body('company_name').trim().notEmpty().withMessage('Company name is required'),
  body('job_title').trim().notEmpty().withMessage('Job title is required'),
  body('scheduled_date').optional(),
  body('duration').optional().custom((value, { req }) => {
    // If status is uncertain, allow null/empty duration
    if (req.body.status === 'uncertain') {
      return true;
    }
    // For other statuses, validate as integer between 15-480
    if (value === null || value === undefined || value === '') {
      throw new Error('Duration is required for non-uncertain interviews');
    }
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 15 || numValue > 480) {
      throw new Error('Duration must be a number between 15 and 480 minutes');
    }
    return true;
  }),
  body('round').isInt({ min: 1, max: 10 }).withMessage('Round must be a number between 1 and 10'),
  body('status').optional().isIn(['scheduled', 'uncertain', 'completed', 'cancelled']),
  body('interview_type').optional().isIn(['hr', 'technical', 'final']),
  body('location').optional().trim(),
  body('notes').optional().trim(),
  body('company_website').optional().trim(),
  body('company_linkedin_url').optional().trim(),
  body('other_urls').optional().trim(),
  body('job_description').optional().trim(),
  body('salary_range').optional().trim(),
  body('interviewer_name').optional().trim(),
  body('interviewer_email').optional().trim(),
  body('interviewer_position').optional().trim(),
  body('interviewer_linkedin_url').optional().trim()
], validateRequest, async (req, res) => {
  try {
    console.log('=== BACKEND DEBUG ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    const {
      company_name,
      job_title,
      scheduled_date,
      duration = 60,
      round = 1,
      status = 'scheduled',
      interview_type = 'technical',
      location,
      notes,
      company_website,
      company_linkedin_url,
      other_urls,
      job_description,
      salary_range,
      interviewer_name,
      interviewer_email,
      interviewer_position,
      interviewer_linkedin_url
    } = req.body;
    
    console.log('Extracted values:');
    console.log('- company_name:', company_name);
    console.log('- job_title:', job_title);
    console.log('- scheduled_date:', scheduled_date);
    console.log('- duration:', duration, 'type:', typeof duration);
    console.log('- round:', round, 'type:', typeof round);
    console.log('- status:', status);
    
    // Ensure round is an integer
    const roundNumber = parseInt(round, 10);
    console.log('- roundNumber:', roundNumber);
    
    // Validate required fields
    if (!company_name || !company_name.trim()) {
      console.log('ERROR: company_name is missing or empty');
      return res.status(400).json({ error: 'Company name is required' });
    }
    
    if (!job_title || !job_title.trim()) {
      console.log('ERROR: job_title is missing or empty');
      return res.status(400).json({ error: 'Job title is required' });
    }
    
    if (!roundNumber || roundNumber < 1 || roundNumber > 10) {
      console.log('ERROR: round is invalid:', roundNumber);
      return res.status(400).json({ error: 'Round must be a number between 1 and 10' });
    }
    
    console.log('All validations passed, creating interview...');
    
    // Create interview for the current candidate
    const result = await run(`
      INSERT INTO interviews (
        candidate_id, company_name, job_title, scheduled_date, duration, 
        round, interview_type, location, notes, status,
        company_website, company_linkedin_url, other_urls, job_description, salary_range,
        interviewer_name, interviewer_email, interviewer_position, interviewer_linkedin_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      req.user.userId, company_name, job_title, scheduled_date, duration, roundNumber, interview_type, location, notes, status,
      company_website, company_linkedin_url, other_urls, job_description, salary_range,
      interviewer_name, interviewer_email, interviewer_position, interviewer_linkedin_url
    ]);
    
    // Get the created interview
    const newInterview = await get(`
      SELECT 
        i.*,
        u.name as candidate_name,
        u.email as candidate_email
      FROM interviews i
      JOIN users u ON i.candidate_id = u.id
      WHERE i.id = ?
    `, [result.id]);
    
    res.status(201).json({
      message: 'Interview scheduled successfully',
      interview: newInterview
    });
    
  } catch (error) {
    console.error('Create interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update interview (with access control)
router.put('/:id', [
  authenticateToken,
  body('company_name').optional().trim().notEmpty().withMessage('Company name cannot be empty'),
  body('job_title').optional().trim().notEmpty().withMessage('Job title cannot be empty'),
  body('scheduled_date').optional(),
  body('duration').optional().custom((value, { req }) => {
    // If status is uncertain, allow null/empty duration
    if (req.body.status === 'uncertain') {
      return true;
    }
    // For other statuses, validate as integer between 15-480
    if (value === null || value === undefined || value === '') {
      throw new Error('Duration is required for non-uncertain interviews');
    }
    const numValue = parseInt(value, 10);
    if (isNaN(numValue) || numValue < 15 || numValue > 480) {
      throw new Error('Duration must be a number between 15 and 480 minutes');
    }
    return true;
  }),
  body('status').optional().isIn(['scheduled', 'uncertain', 'completed', 'cancelled', 'rescheduled']),
  body('round').optional().isInt({ min: 1, max: 10 }).withMessage('Round must be a number between 1 and 10'),
  body('interview_type').optional().isIn(['hr', 'technical', 'final']),
  body('location').optional().trim(),
  body('notes').optional().trim(),
  body('company_website').optional().trim(),
  body('company_linkedin_url').optional().trim(),
  body('other_urls').optional().trim(),
  body('job_description').optional().trim(),
  body('salary_range').optional().trim(),
  body('interviewer_name').optional().trim(),
  body('interviewer_email').optional().trim(),
  body('interviewer_position').optional().trim(),
  body('interviewer_linkedin_url').optional().trim()
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      company_name,
      job_title,
      scheduled_date,
      duration,
      status,
      round,
      interview_type,
      location,
      notes,
      company_website,
      company_linkedin_url,
      other_urls,
      job_description,
      salary_range,
      interviewer_name,
      interviewer_email,
      interviewer_position,
      interviewer_linkedin_url
    } = req.body;
    
    // Check if interview exists and user has access
    let query = 'SELECT * FROM interviews WHERE id = ?';
    const params = [id];
    
    if (req.user.role !== 'admin') {
      query += ' AND candidate_id = ?';
      params.push(req.user.userId);
    }
    
    const existingInterview = await get(query, params);
    
    if (!existingInterview) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    // Build update query with all fields
    const updateFields = [];
    const updateValues = [];
    
    if (company_name !== undefined) {
      updateFields.push('company_name = ?');
      updateValues.push(company_name);
    }
    
    if (job_title !== undefined) {
      updateFields.push('job_title = ?');
      updateValues.push(job_title);
    }
    
    if (scheduled_date !== undefined) {
      updateFields.push('scheduled_date = ?');
      updateValues.push(scheduled_date);
    }
    
    if (duration !== undefined) {
      updateFields.push('duration = ?');
      updateValues.push(duration);
    }
    
    if (status !== undefined) {
      updateFields.push('status = ?');
      updateValues.push(status);
    }
    
    if (round !== undefined) {
      updateFields.push('round = ?');
      updateValues.push(round);
    }
    
    if (interview_type !== undefined) {
      updateFields.push('interview_type = ?');
      updateValues.push(interview_type);
    }
    
    if (location !== undefined) {
      updateFields.push('location = ?');
      updateValues.push(location);
    }
    
    if (notes !== undefined) {
      updateFields.push('notes = ?');
      updateValues.push(notes);
    }
    
    if (company_website !== undefined) {
      updateFields.push('company_website = ?');
      updateValues.push(company_website);
    }
    
    if (company_linkedin_url !== undefined) {
      updateFields.push('company_linkedin_url = ?');
      updateValues.push(company_linkedin_url);
    }
    
    if (other_urls !== undefined) {
      updateFields.push('other_urls = ?');
      updateValues.push(other_urls);
    }
    
    if (job_description !== undefined) {
      updateFields.push('job_description = ?');
      updateValues.push(job_description);
    }
    
    if (salary_range !== undefined) {
      updateFields.push('salary_range = ?');
      updateValues.push(salary_range);
    }
    

    
    if (interviewer_name !== undefined) {
      updateFields.push('interviewer_name = ?');
      updateValues.push(interviewer_name);
    }
    
    if (interviewer_email !== undefined) {
      updateFields.push('interviewer_email = ?');
      updateValues.push(interviewer_email);
    }
    
    if (interviewer_position !== undefined) {
      updateFields.push('interviewer_position = ?');
      updateValues.push(interviewer_position);
    }
    
    if (interviewer_linkedin_url !== undefined) {
      updateFields.push('interviewer_linkedin_url = ?');
      updateValues.push(interviewer_linkedin_url);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    
    // Add the interview ID for the WHERE clause
    updateValues.push(id);
    
    // Execute update
    await run(`
      UPDATE interviews SET ${updateFields.join(', ')} WHERE id = ?
    `, updateValues);
    
    // Get updated interview
    const updatedInterview = await get(`
      SELECT 
        i.*,
        u.name as candidate_name,
        u.email as candidate_email
      FROM interviews i
      JOIN users u ON i.candidate_id = u.id
      WHERE i.id = ?
    `, [id]);
    
    res.json({
      message: 'Interview updated successfully',
      interview: updatedInterview
    });
    
  } catch (error) {
    console.error('Update interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete interview (with access control)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if interview exists and user has access
    let query = 'SELECT * FROM interviews WHERE id = ?';
    const params = [id];
    
    if (req.user.role !== 'admin') {
      query += ' AND candidate_id = ?';
      params.push(req.user.userId);
    }
    
    const interview = await get(query, params);
    
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    // Delete interview
    await run('DELETE FROM interviews WHERE id = ?', [id]);
    
    res.json({ message: 'Interview deleted successfully' });
    
  } catch (error) {
    console.error('Delete interview error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Submit interview feedback (candidate receives feedback)
router.post('/:id/feedback', [
  authenticateToken,
  body('technical_skills').isInt({ min: 1, max: 5 }),
  body('communication_skills').isInt({ min: 1, max: 5 }),
  body('problem_solving').isInt({ min: 1, max: 5 }),
  body('cultural_fit').isInt({ min: 1, max: 5 }),
  body('overall_rating').isInt({ min: 1, max: 5 }),
  body('feedback_text').trim().isLength({ min: 10 }),
  body('recommendation').isIn(['hire', 'reject', 'maybe'])
], validateRequest, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      technical_skills,
      communication_skills,
      problem_solving,
      cultural_fit,
      overall_rating,
      feedback_text,
      recommendation
    } = req.body;
    
    // Check if interview exists and belongs to the candidate
    const interview = await get(
      'SELECT * FROM interviews WHERE id = ? AND candidate_id = ?',
      [id, req.user.userId]
    );
    
    if (!interview) {
      return res.status(404).json({ error: 'Interview not found or unauthorized' });
    }
    
    // Check if feedback already exists
    const existingFeedback = await get(
      'SELECT id FROM interview_feedback WHERE interview_id = ? AND candidate_id = ?',
      [id, req.user.userId]
    );
    
    if (existingFeedback) {
      return res.status(400).json({ error: 'Feedback already submitted for this interview' });
    }
    
    // Insert feedback
    await run(`
      INSERT INTO interview_feedback (
        interview_id, candidate_id, technical_skills, communication_skills,
        problem_solving, cultural_fit, overall_rating, feedback_text, recommendation
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, req.user.userId, technical_skills, communication_skills, problem_solving, cultural_fit, overall_rating, feedback_text, recommendation]);
    
    // Update interview status to completed
    await run(
      'UPDATE interviews SET status = ? WHERE id = ?',
      ['completed', id]
    );
    
    res.status(201).json({ message: 'Feedback received successfully' });
    
  } catch (error) {
    console.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router; 