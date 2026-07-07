const express = require('express');
const db = require('../database');

const router = express.Router();

const toIsoDate = (d) => d.toISOString().slice(0, 10);
const addDays = (dateStr, days) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};
const addMonths = (dateStr, months) => {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + months);
  return toIsoDate(d);
};

const ensureRecurringGenerated = (userId) => {
  const today = toIsoDate(new Date());
  const recurringRows = db.prepare(`
    SELECT id, description, amount, category_id, frequency, next_run_date, end_date, notes
    FROM recurring_expenses
    WHERE user_id = ? AND active = 1 AND next_run_date <= ?
    ORDER BY next_run_date ASC
  `).all(userId, today);

  const insertExpense = db.prepare(`
    INSERT OR IGNORE INTO expenses (user_id, description, amount, category_id, date, notes, recurring_source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateRecurring = db.prepare(`
    UPDATE recurring_expenses
    SET next_run_date = ?, active = ?
    WHERE id = ? AND user_id = ?
  `);

  const tx = db.transaction((rows) => {
    rows.forEach((row) => {
      let nextDate = row.next_run_date;
      let active = 1;
      while (nextDate <= today) {
        insertExpense.run(userId, row.description, row.amount, row.category_id, nextDate, row.notes || null, row.id);
        nextDate = row.frequency === 'weekly' ? addDays(nextDate, 7) : addMonths(nextDate, 1);
        if (row.end_date && nextDate > row.end_date) {
          active = 0;
          break;
        }
      }
      updateRecurring.run(nextDate, active, row.id, userId);
    });
  });
  tx(recurringRows);
};

function buildExpenseFilters(query, userId) {
  const { category_id, month, year, q = '' } = query;
  let where = 'WHERE e.user_id = ?';
  const params = [userId];

  if (category_id) {
    where += ' AND e.category_id = ?';
    params.push(category_id);
  }
  if (month && year) {
    where += " AND strftime('%m', e.date) = ? AND strftime('%Y', e.date) = ?";
    params.push(String(month).padStart(2, '0'), String(year));
  } else if (year) {
    where += " AND strftime('%Y', e.date) = ?";
    params.push(String(year));
  }
  if (q && String(q).trim()) {
    where += ' AND LOWER(e.description) LIKE ?';
    params.push(`%${String(q).trim().toLowerCase()}%`);
  }
  return { where, params };
}

router.use((req, res, next) => {
  try {
    ensureRecurringGenerated(req.user.id);
    next();
  } catch (error) {
    next(error);
  }
});

// GET expenses with optional filters
router.get('/', (req, res) => {
  const { page = '1', limit = '10', all = '0' } = req.query;
  const parsedPage = Math.max(1, parseInt(page, 10) || 1);
  const parsedLimit = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
  const offset = (parsedPage - 1) * parsedLimit;
  const wantsAll = String(all) === '1';

  const { where, params } = buildExpenseFilters(req.query, req.user.id);

  const countQuery = `
    SELECT COUNT(*) as total
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    ${where}
  `;
  const countResult = db.prepare(countQuery).get(...params);
  const total = countResult.total || 0;

  let query = `
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    ${where}
    ORDER BY e.date DESC, e.created_at DESC
  `;
  const queryParams = [...params];
  if (!wantsAll) {
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parsedLimit, offset);
  }

  const rows = db.prepare(query).all(...queryParams);
  const effectiveLimit = wantsAll ? Math.max(1, total) : parsedLimit;
  const totalPages = wantsAll ? 1 : Math.max(1, Math.ceil(total / parsedLimit));

  res.json({
    items: rows,
    pagination: {
      page: wantsAll ? 1 : parsedPage,
      limit: effectiveLimit,
      total,
      totalPages,
    },
  });
});

// GET recurring templates
router.get('/recurring', (req, res) => {
  const rows = db.prepare(`
    SELECT r.*, c.name AS category_name, c.color AS category_color, c.icon AS category_icon
    FROM recurring_expenses r
    JOIN categories c ON c.id = r.category_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

// POST recurring template
router.post('/recurring', (req, res) => {
  const { description, amount, category_id, frequency, start_date, end_date, notes } = req.body;
  if (!description || amount == null || !category_id || !frequency || !start_date) {
    return res.status(400).json({ error: 'description, amount, category_id, frequency and start_date are required' });
  }
  if (!['weekly', 'monthly'].includes(frequency)) {
    return res.status(400).json({ error: 'frequency must be weekly or monthly' });
  }
  const numericAmount = parseFloat(amount);
  if (Number.isNaN(numericAmount) || numericAmount < 0) {
    return res.status(400).json({ error: 'amount must be a valid positive number' });
  }

  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.id);
  if (!category) return res.status(400).json({ error: 'Invalid category' });

  const result = db.prepare(`
    INSERT INTO recurring_expenses (user_id, description, amount, category_id, frequency, start_date, next_run_date, end_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id,
    description.trim(),
    numericAmount,
    category_id,
    frequency,
    start_date,
    start_date,
    end_date || null,
    notes || null
  );

  const row = db.prepare('SELECT * FROM recurring_expenses WHERE id = ? AND user_id = ?').get(result.lastInsertRowid, req.user.id);
  res.status(201).json(row);
});

router.delete('/recurring/:id', (req, res) => {
  const result = db.prepare('DELETE FROM recurring_expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  return res.status(204).send();
});

// Import rows from CSV
router.post('/import', (req, res) => {
  const rows = Array.isArray(req.body.rows) ? req.body.rows : null;
  if (!rows) return res.status(400).json({ error: 'rows array is required' });

  const findCategory = db.prepare('SELECT id FROM categories WHERE user_id = ? AND LOWER(name) = LOWER(?)');
  const createCategory = db.prepare(`
    INSERT INTO categories (user_id, name, color, icon, budget)
    VALUES (?, ?, '#6366f1', '📦', NULL)
  `);
  const insertExpense = db.prepare(`
    INSERT INTO expenses (user_id, description, amount, category_id, date, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  let imported = 0;
  let failed = 0;
  const errors = [];

  const tx = db.transaction(() => {
    rows.forEach((row, idx) => {
      try {
        const description = String(row.description || '').trim();
        const categoryName = String(row.category || '').trim();
        const date = String(row.date || '').trim();
        const notes = row.notes == null ? null : String(row.notes);
        const amount = parseFloat(row.amount);

        if (!description || !categoryName || !date || Number.isNaN(amount)) {
          throw new Error('Missing required fields');
        }

        let category = findCategory.get(req.user.id, categoryName);
        if (!category) {
          const created = createCategory.run(req.user.id, categoryName);
          category = { id: created.lastInsertRowid };
        }

        insertExpense.run(req.user.id, description, amount, category.id, date, notes);
        imported += 1;
      } catch (error) {
        failed += 1;
        errors.push({ row: idx + 1, error: error.message });
      }
    });
  });
  tx();

  return res.json({ imported, failed, errors: errors.slice(0, 20) });
});

// Set monthly savings goal
router.put('/goal', (req, res) => {
  const { month, year, target_amount } = req.body;
  if (!month || !year || target_amount == null) {
    return res.status(400).json({ error: 'month, year and target_amount are required' });
  }
  const target = parseFloat(target_amount);
  if (Number.isNaN(target) || target < 0) {
    return res.status(400).json({ error: 'target_amount must be a positive number' });
  }
  const key = `${year}-${String(month).padStart(2, '0')}`;
  db.prepare(`
    INSERT INTO savings_goals (user_id, month, target_amount, created_at, updated_at)
    VALUES (?, ?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(user_id, month)
    DO UPDATE SET target_amount = excluded.target_amount, updated_at = datetime('now')
  `).run(req.user.id, key, target);
  const goal = db.prepare('SELECT month, target_amount FROM savings_goals WHERE user_id = ? AND month = ?').get(req.user.id, key);
  return res.json({ goal });
});

// GET summary (totals by category + trend + savings goal)
router.get('/summary', (req, res) => {
  const { month, year } = req.query;
  let where = 'e.user_id = ?';
  const params = [req.user.id];

  if (month && year) {
    where += " AND strftime('%m', e.date) = ? AND strftime('%Y', e.date) = ?";
    params.push(String(month).padStart(2, '0'), String(year));
  } else if (year) {
    where += " AND strftime('%Y', e.date) = ?";
    params.push(String(year));
  }

  const totals = db.prepare(`
    SELECT c.id, c.name, c.color, c.icon, c.budget, COALESCE(SUM(e.amount), 0) as total, COUNT(e.id) as count
    FROM categories c
    LEFT JOIN expenses e ON e.category_id = c.id AND ${where}
    WHERE c.user_id = ?
    GROUP BY c.id
    ORDER BY total DESC
  `).all(...params, req.user.id);

  const grand = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total, COUNT(*) as count
    FROM expenses e WHERE ${where}
  `).get(...params);

  const now = new Date();
  const months = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('es-ES', { month: 'short' });
    months.push({ ym, label, total: 0 });
  }
  const start = `${months[0].ym}-01`;
  const endYear = now.getFullYear();
  const endMonth = String(now.getMonth() + 1).padStart(2, '0');
  const end = `${endYear}-${endMonth}-31`;

  const trendRows = db.prepare(`
    SELECT strftime('%Y-%m', date) AS ym, COALESCE(SUM(amount), 0) AS total
    FROM expenses
    WHERE user_id = ? AND date >= ? AND date <= ?
    GROUP BY ym
    ORDER BY ym
  `).all(req.user.id, start, end);

  const trendMap = new Map(trendRows.map((row) => [row.ym, row.total]));
  const monthly_trend = months.map((m) => ({ ...m, total: trendMap.get(m.ym) || 0 }));

  const goalMonth = `${year || endYear}-${String(month || endMonth).padStart(2, '0')}`;
  const goal = db.prepare('SELECT month, target_amount FROM savings_goals WHERE user_id = ? AND month = ?').get(req.user.id, goalMonth);
  const targetAmount = goal?.target_amount ?? null;
  const spent = grand.total || 0;
  const remaining = targetAmount == null ? null : Math.max(targetAmount - spent, 0);
  const progress = targetAmount && targetAmount > 0 ? Math.min((spent / targetAmount) * 100, 100) : 0;

  res.json({
    totals,
    grand_total: grand.total,
    grand_count: grand.count,
    monthly_trend,
    savings_goal: {
      month: goalMonth,
      target_amount: targetAmount,
      spent,
      remaining,
      progress_pct: progress,
    },
  });
});

// GET single expense
router.get('/:id', (req, res) => {
  const row = db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = ? AND e.user_id = ?
  `).get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json(row);
});

// POST create expense
router.post('/', (req, res) => {
  const { description, amount, category_id, date, notes } = req.body;
  if (!description || amount == null || !category_id || !date) {
    return res.status(400).json({ error: 'description, amount, category_id and date are required' });
  }

  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.id);
  if (!category) return res.status(400).json({ error: 'Invalid category' });

  const numericAmount = parseFloat(amount);
  if (Number.isNaN(numericAmount) || numericAmount < 0) {
    return res.status(400).json({ error: 'amount must be a valid positive number' });
  }

  const result = db.prepare(
    'INSERT INTO expenses (user_id, description, amount, category_id, date, notes) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(req.user.id, description.trim(), numericAmount, category_id, date, notes || null);

  const row = db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = ? AND e.user_id = ?
  `).get(result.lastInsertRowid, req.user.id);
  return res.status(201).json(row);
});

// PUT update expense
router.put('/:id', (req, res) => {
  const { description, amount, category_id, date, notes } = req.body;
  if (!description || amount == null || !category_id || !date) {
    return res.status(400).json({ error: 'description, amount, category_id and date are required' });
  }

  const category = db.prepare('SELECT id FROM categories WHERE id = ? AND user_id = ?').get(category_id, req.user.id);
  if (!category) return res.status(400).json({ error: 'Invalid category' });

  const numericAmount = parseFloat(amount);
  if (Number.isNaN(numericAmount) || numericAmount < 0) {
    return res.status(400).json({ error: 'amount must be a valid positive number' });
  }

  const result = db.prepare(
    'UPDATE expenses SET description=?, amount=?, category_id=?, date=?, notes=? WHERE id=? AND user_id=?'
  ).run(description.trim(), numericAmount, category_id, date, notes || null, req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });

  const row = db.prepare(`
    SELECT e.*, c.name as category_name, c.color as category_color, c.icon as category_icon
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.id = ? AND e.user_id = ?
  `).get(req.params.id, req.user.id);
  return res.json(row);
});

// DELETE expense
router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  return res.status(204).send();
});

module.exports = router;
