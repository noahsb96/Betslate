import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import pool from '../database.js';
import { sendVerificationEmail, sendPasswordResetEmail, sendPasswordChangedEmail, sendEmailChangeConfirmation } from '../services/emailService.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later.' }
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.'
      });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userResult = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id',
      [normalizedEmail, passwordHash]
    );
    const userId = userResult.rows[0].id;

    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [token, userId, expires]
    );

    await sendVerificationEmail(normalizedEmail, token);

    res.status(201).json({ message: 'Account created. Please check your email to confirm your account.' });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email address before logging in. Check your inbox for the confirmation link.' });
    }

    const expiresIn = rememberMe ? '30d' : '24h';
    const token = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    res.json({
      token,
      user: { id: user.id, email: user.email },
      rememberMe: !!rememberMe
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/verify-email
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required.' });
    }

    const result = await pool.query(
      'SELECT * FROM email_verification_tokens WHERE token = $1',
      [token]
    );
    const row = result.rows[0];

    if (!row) {
      return res.status(400).json({ error: 'Invalid or already used verification link.' });
    }

    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'Verification link has expired. Please register again.' });
    }

    await pool.query('UPDATE users SET email_verified = true WHERE id = $1', [row.user_id]);
    await pool.query('DELETE FROM email_verification_tokens WHERE token = $1', [token]);

    res.json({ message: 'Email verified successfully. You can now log in.' });
  } catch (err) {
    console.error('Verify email error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', authLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query(
      'SELECT id, email_verified FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];

    // Always return success to prevent user enumeration
    if (user && !user.email_verified) {
      await pool.query('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await pool.query(
        'INSERT INTO email_verification_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, user.id, expires]
      );
      await sendVerificationEmail(normalizedEmail, token);
    }

    res.json({ message: 'If that email is registered and unverified, a new confirmation link has been sent.' });
  } catch (err) {
    console.error('Resend verification error:', err);
    res.status(500).json({ error: 'Failed to resend verification email. Please try again.' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const result = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    const user = result.rows[0];

    // Always return success to prevent user enumeration
    if (user) {
      await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await pool.query(
        'INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
        [token, user.id, expires]
      );
      await sendPasswordResetEmail(normalizedEmail, token);
    }

    res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Request failed. Please try again.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }

    if (!PASSWORD_REGEX.test(password)) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.'
      });
    }

    const result = await pool.query(
      'SELECT * FROM password_reset_tokens WHERE token = $1',
      [token]
    );
    const row = result.rows[0];

    if (!row) {
      return res.status(400).json({ error: 'Invalid or already used reset link.' });
    }

    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'Reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
    await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email });
});

// POST /api/auth/change-password  (protected)
router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new passwords are required.' });
    }

    if (!PASSWORD_REGEX.test(newPassword)) {
      return res.status(400).json({
        error: 'New password must be at least 8 characters and include an uppercase letter, lowercase letter, number, and special character.'
      });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const samePassword = await bcrypt.compare(newPassword, user.password_hash);
    if (samePassword) {
      return res.status(400).json({ error: 'New password must be different from your current password.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);

    await sendPasswordChangedEmail(user.email);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password. Please try again.' });
  }
});

// POST /api/auth/change-email  (protected)
router.post('/change-email', authLimiter, requireAuth, async (req, res) => {
  try {
    const { currentPassword, newEmail } = req.body;

    if (!currentPassword || !newEmail) {
      return res.status(400).json({ error: 'Current password and new email are required.' });
    }

    const normalizedEmail = newEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }

    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    if (normalizedEmail === user.email) {
      return res.status(400).json({ error: 'New email is the same as your current email.' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    // Delete any pending change token for this user then create a fresh one
    await pool.query('DELETE FROM email_change_tokens WHERE user_id = $1', [req.user.id]);
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query(
      'INSERT INTO email_change_tokens (token, user_id, new_email, expires_at) VALUES ($1, $2, $3, $4)',
      [token, req.user.id, normalizedEmail, expires]
    );

    await sendEmailChangeConfirmation(normalizedEmail, token);

    res.json({ message: `A confirmation link has been sent to ${normalizedEmail}. Click it to complete the change.` });
  } catch (err) {
    console.error('Change email error:', err);
    res.status(500).json({ error: 'Failed to initiate email change. Please try again.' });
  }
});

// GET /api/auth/confirm-email-change?token=...
router.get('/confirm-email-change', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ error: 'Confirmation token is required.' });
    }

    const result = await pool.query(
      'SELECT * FROM email_change_tokens WHERE token = $1',
      [token]
    );
    const row = result.rows[0];

    if (!row) {
      return res.status(400).json({ error: 'Invalid or already used confirmation link.' });
    }

    if (new Date(row.expires_at) < new Date()) {
      await pool.query('DELETE FROM email_change_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'Confirmation link has expired. Please request a new email change.' });
    }

    // Ensure the new email hasn't been taken by someone else in the meantime
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [row.new_email]);
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM email_change_tokens WHERE token = $1', [token]);
      return res.status(409).json({ error: 'This email address is already in use by another account.' });
    }

    await pool.query('UPDATE users SET email = $1 WHERE id = $2', [row.new_email, row.user_id]);
    await pool.query('DELETE FROM email_change_tokens WHERE token = $1', [token]);

    res.json({ message: 'Email address updated successfully. Please log in again.' });
  } catch (err) {
    console.error('Confirm email change error:', err);
    res.status(500).json({ error: 'Confirmation failed. Please try again.' });
  }
});

export default router;
