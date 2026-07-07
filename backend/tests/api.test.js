const fs = require('fs');
const path = require('path');
const request = require('supertest');

const TEST_DB = path.join(__dirname, 'test-spendly.db');
process.env.DB_PATH = TEST_DB;
process.env.JWT_SECRET = 'test-secret';
process.env.DEMO_EMAIL = 'demo@test.local';
process.env.DEMO_PASSWORD = 'demo1234';

if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);

const app = require('../server');

describe('Spendly API', () => {
  let token;
  let categoryId;
  let expenseId;

  beforeAll(async () => {
    const email = `user${Date.now()}@mail.com`;
    const register = await request(app).post('/api/auth/register').send({ email, password: '123456' });
    token = register.body.token;

    const categories = await request(app)
      .get('/api/categories')
      .set('Authorization', `Bearer ${token}`);
    categoryId = categories.body[0].id;
  });

  test('requires auth for expenses list', async () => {
    const res = await request(app).get('/api/expenses');
    expect(res.status).toBe(401);
  });

  test('creates expense with valid payload', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({
        description: 'Café',
        amount: 4.5,
        category_id: categoryId,
        date: '2026-07-06',
        notes: 'Prueba',
      });
    expect(res.status).toBe(201);
    expect(res.body.description).toBe('Café');
    expenseId = res.body.id;
  });

  test('fails create expense on invalid payload', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ description: '', amount: -1 });
    expect(res.status).toBe(400);
  });

  test('lists expenses with pagination shape', async () => {
    const res = await request(app)
      .get('/api/expenses?page=1&limit=10')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.pagination).toBeDefined();
  });

  test('deletes expense', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  test('returns 404 on deleting missing expense', async () => {
    const res = await request(app)
      .delete(`/api/expenses/${expenseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
