const express = require('express');
const db = require('../database');
const router = express.Router();

// GET all categories
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM categories WHERE user_id = ? ORDER BY name').all(req.user.id);
  res.json(rows);
});

// POST create category
router.post('/', (req, res, next) => {
  const { name, color, icon, budget } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const normalizedBudget =
      budget === '' || budget == null ? null : Math.max(0, parseFloat(budget));
    const result = db.prepare(
      'INSERT INTO categories (user_id, name, color, icon, budget) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, name.trim(), color || '#6366f1', icon || '💰', normalizedBudget);
    const row = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
    res.status(201).json(row);
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Category already exists' });
    return next(e);
  }
});

// PUT update category
router.put('/:id', (req, res) => {
  const { name, color, icon, budget } = req.body;
  const { id } = req.params;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const normalizedBudget = budget === '' || budget == null ? null : Math.max(0, parseFloat(budget));
  db.prepare('UPDATE categories SET name=?, color=?, icon=?, budget=? WHERE id=? AND user_id=?').run(
    name.trim(), color || '#6366f1', icon || '💰', normalizedBudget, id, req.user.id
  );
  const row = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

// DELETE category
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM categories WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.status(204).send();
});

module.exports = router;
