require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authRequired } = require('./src/middleware/auth');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/categories', authRequired, require('./src/routes/categories'));
app.use('/api/expenses', authRequired, require('./src/routes/expenses'));

app.get('/api/health', (_, res) => res.json({ status: 'ok' }));

app.use(/^\/api\/.*/, (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || err.status || 500;
  const message = status >= 500 ? 'Internal server error' : (err.message || 'Request failed');
  res.status(status).json({ error: message });
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`Spendly API running on http://localhost:${PORT}`));
}

module.exports = app;
