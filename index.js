-- QUERY TRUNCATED
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// ========== AUTH ==========
app.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await pool.query(
      `SELECT id, name, role, email, phone, qualification, profile_pic 
       FROM users WHERE username = $1 AND password = $2`,
      [username.trim(), password]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Invalid username or password.' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      qualification: user.qualification || '',
      profilePic: user.profile_pic || ''
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/reset-password', async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(
      'SELECT id, name FROM users WHERE email = $1',
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'Email address not found.' });
    }

    const user = result.rows[0];
    const newPassword = Math.random().toString(36).slice(-8);

    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, user.id]);

    // Note: Email sending should be done from Apps Script (MailApp)
    res.json({
      success: true,
      message: 'Password reset successfully.',
      tempPassword: newPassword,
      name: user.name
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== PROFILE ==========
app.get('/profile/:userId', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, email, phone, qualification, profile_pic 
       FROM users WHERE id = $1`,
      [req.params.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ success: false, message: 'User not found.' });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email || '',
      phone: user.phone || '',
      qualification: user.qualification || '',
      profilePic: user.profile_pic || ''
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/profile/:userId', async (req, res) => {
  try {
    const { email, phone, qualification } = req.body;
    await pool.query(
      `UPDATE users SET email = $1, phone = $2, qualification = $3 WHERE id = $4`,
      [email || '', phone || '', qualification || '', req.params.userId]
    );
    res.json({ success: true, message: 'Profile updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/profile-picture/:userId', async (req, res) => {
  try {
    const { url } = req.body;
    await pool.query('UPDATE users SET profile_pic = $1 WHERE id = $2', [url, req.params.userId]);
    res.json({ success: true, message: 'Profile picture updated!', url });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/password/:userId', async (req, res) => {
  try {
    const { newPassword } = req.body;
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [newPassword, req.params.userId]
    );
    if (result.rowCount === 0) {
      return res.json({ success: false, message: 'User not found.' });
    }
    res.json({ success: true, message: 'Your password has been successfully updated!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== DASHBOARD ==========
app.get('/dashboard-stats', async (req, res) => {
  try {
    const students = await pool.query('SELECT COUNT(*) FROM students');
    const teachers = await pool.query(
      `SELECT COUNT(*) FROM users WHERE role IN ('Teacher', 'Academic', 'Academic Teacher')`
    );

    res.json({
      studentCount: parseInt(students.rows[0].count),
      teacherCount: parseInt(teachers.rows[0].count),
      attendanceRate: 94
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== REGISTRATION ==========
app.post('/register-teacher', async (req, res) => {
  try {
    const { name, username, password, email, className } = req.body;
    const teacherId = 'T' + Math.floor(Math.random() * 10000);
    const classId = 'C' + Math.floor(Math.random() * 10000);

    await pool.query(
      `INSERT INTO users (id, name, role, username, password, email) 
       VALUES ($1, $2, 'Teacher', $3, $4, $5)`,
      [teacherId, name, username, password, email || '']
    );

    await pool.query(
      `INSERT INTO classes (id, class_name, teacher_id) VALUES ($1, $2, $3)`,
      [classId, className, teacherId]
    );

    res.json({ success: true, message: `Teacher registered and assigned to ${className}!` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/register-student', async (req, res) => {
  try {
    const { name, class: className, registeredBy } = req.body;
    const studentId = 'S' + Math.floor(Math.random() * 10000);

    await pool.query(
      `INSERT INTO students (id, name, class_name, registered_by) VALUES ($1, $2, $3, $4)`,
      [studentId, name, className, registeredBy]
    );

    res.json({ success: true, message: 'Student registered successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== LISTS ==========
app.get('/teachers', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, role, email, phone, qualification, profile_pic 
       FROM users WHERE role IN ('Teacher', 'Academic', 'Academic Teacher') 
       ORDER BY name`
    );

    const list = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      email: r.email || '-',
      phone: r.phone || '-',
      qualification: r.qualification || '-',
      profilePic: r.profile_pic || ''
    }));

    res.json(list);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/students', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, class_name FROM students ORDER BY name`
    );
    const list = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      class: r.class_name
    }));
    res.json(list);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/my-students/:teacherId', async (req, res) => {
  try {
    const classRes = await pool.query(
      'SELECT class_name FROM classes WHERE teacher_id = $1',
      [req.params.teacherId]
    );

    if (classRes.rows.length === 0) return res.json([]);

    const className = classRes.rows[0].class_name;
    const result = await pool.query(
      'SELECT id, name, class_name FROM students WHERE class_name = $1 ORDER BY name',
      [className]
    );

    const list = result.rows.map(r => ({
      id: r.id,
      name: r.name,
      class: r.class_name
    }));

    res.json(list);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== DELETE ==========
app.delete('/student/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    if (result.rowCount === 0) {
      return res.json({ success: false, message: 'Student not found.' });
    }
    res.json({ success: true, message: 'Student deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/teacher/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM classes WHERE teacher_id = $1', [req.params.id]);
    const result = await pool.query('DELETE FROM users WHERE id = $1', [req.params.id]);

    if (result.rowCount === 0) {
      return res.json({ success: false, message: 'Teacher not found.' });
    }
    res.json({ success: true, message: 'Teacher deleted successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== DOCUMENTS ==========
app.post('/documents', async (req, res) => {
  try {
    const { teacherId, fileUrl } = req.body;
    const docId = 'D' + Math.floor(Math.random() * 10000);

    await pool.query(
