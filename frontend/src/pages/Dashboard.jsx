import { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getSummary, setSavingsGoal } from '../services/api';
import './Dashboard.css';

export default function Dashboard() {
  const { selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useApp();
  const { language, locale } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [goalInput, setGoalInput] = useState('');
  const [goalSaving, setGoalSaving] = useState(false);

  const currency = user?.currency || 'USD';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSummary({ month: selectedMonth, year: selectedYear });
      setSummary(data);
      setGoalInput(data.savings_goal?.target_amount != null ? String(data.savings_goal.target_amount) : '');
    } catch (e) {
      setSummary({ totals: [], grand_total: 0, grand_count: 0, monthly_trend: [], savings_goal: {} });
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  const fmtCompact = (n) => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const MONTHS = language === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 3; y--) years.push(y);

  const saveGoal = async () => {
    if (!goalInput) return;
    setGoalSaving(true);
    try {
      await setSavingsGoal({ month: selectedMonth, year: selectedYear, target_amount: goalInput });
      toast.success(language === 'en' ? 'Goal saved.' : 'Meta guardada.');
      load();
    } finally {
      setGoalSaving(false);
    }
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>{language === 'en' ? 'Dashboard' : 'Dashboard'}</h1>
        <div className="period-selector">
          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">{language === 'en' ? 'Loading…' : 'Cargando…'}</div>
      ) : summary && (
        <>
          <div className="summary-cards">
            <div className="card summary-total">
              <div className="summary-label">{language === 'en' ? 'Month total' : 'Total del mes'}</div>
              <div className="summary-amount">{fmt(summary.grand_total)}</div>
              <div className="summary-count">{summary.grand_count} {language === 'en' ? 'expenses' : 'gastos'}</div>
            </div>
            <div className="card summary-avg">
              <div className="summary-label">{language === 'en' ? 'Average per expense' : 'Promedio por gasto'}</div>
              <div className="summary-amount">
                {summary.grand_count > 0 ? fmt(summary.grand_total / summary.grand_count) : fmt(0)}
              </div>
              <div className="summary-count">{language === 'en' ? 'In' : 'En'} {MONTHS[selectedMonth - 1]} {selectedYear}</div>
            </div>
            <div className="card summary-cats">
              <div className="summary-label">{language === 'en' ? 'Active categories' : 'Categorías activas'}</div>
              <div className="summary-amount">{summary.totals.filter(t => t.total > 0).length}</div>
              <div className="summary-count">{language === 'en' ? 'of' : 'de'} {summary.totals.length} {language === 'en' ? 'total' : 'totales'}</div>
            </div>
            <div className="card summary-cats">
              <div className="summary-label">{language === 'en' ? 'Over budget' : 'Presupuestos superados'}</div>
              <div className="summary-amount">
                {summary.totals.filter(t => t.budget != null && t.total > t.budget).length}
              </div>
              <div className="summary-count">{language === 'en' ? 'categories over budget' : 'categorías fuera de presupuesto'}</div>
            </div>
          </div>

          <div className="card trend-card">
            <h2 className="section-title">{language === 'en' ? 'Monthly savings goal' : 'Meta de ahorro mensual'}</h2>
            <div className="goal-row">
              <input
                type="number"
                min="0"
                step="0.01"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                placeholder={language === 'en' ? 'Target amount' : 'Monto objetivo'}
              />
              <button className="btn btn-primary" onClick={saveGoal} disabled={goalSaving || !goalInput}>
                {goalSaving ? (language === 'en' ? 'Saving…' : 'Guardando…') : (language === 'en' ? 'Save goal' : 'Guardar meta')}
              </button>
            </div>
            {summary.savings_goal?.target_amount != null && (
              <div className="goal-progress">
                <div className="summary-count">
                  {language === 'en' ? 'Progress' : 'Progreso'}: {fmt(summary.savings_goal.spent || 0)} / {fmt(summary.savings_goal.target_amount)}
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${Math.max(0, Math.min(100, summary.savings_goal.progress_pct || 0))}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="card trend-card">
            <h2 className="section-title">{language === 'en' ? 'Trend (last 6 months)' : 'Tendencia (6 meses)'}</h2>
            <div className="trend-chart">
              {summary.monthly_trend?.map((point) => {
                const max = Math.max(...summary.monthly_trend.map((p) => p.total), 1);
                const h = (point.total / max) * 120;
                return (
                  <div className="trend-column" key={point.ym}>
                    <span className="trend-value">{fmtCompact(point.total)}</span>
                    <div className="trend-bar-wrap">
                      <div className="trend-bar" style={{ height: `${Math.max(6, h)}px` }} />
                    </div>
                    <span className="trend-label">{point.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2 className="section-title">{language === 'en' ? 'By category' : 'Por categoría'}</h2>
            {summary.grand_total === 0 ? (
              <div className="empty-state">
                <div className="icon">📭</div>
                <p>{language === 'en' ? 'No expenses for this period.' : 'No hay gastos registrados en este período.'}</p>
              </div>
            ) : (
              <div className="category-bars">
                {summary.totals.filter(t => t.total > 0).map(cat => {
                  const pct = summary.grand_total > 0 ? (cat.total / summary.grand_total) * 100 : 0;
                  return (
                    <div key={cat.id} className="category-bar-item">
                      <div className="cat-info">
                        <span className="cat-icon">{cat.icon}</span>
                        <span className="cat-name">{cat.name}</span>
                        <span className="cat-count">{cat.count} {language === 'en' ? 'expenses' : 'gastos'}</span>
                      </div>
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{ width: `${pct}%`, background: cat.color }}
                        />
                      </div>
                      <div className="cat-amount">{fmt(cat.total)}</div>
                      {cat.budget != null && (
                        <>
                          <div className="bar-track budget-track">
                            <div
                              className="bar-fill"
                              style={{
                                width: `${Math.min((cat.total / Math.max(cat.budget, 1)) * 100, 100)}%`,
                                background: cat.total > cat.budget ? 'var(--danger)' : 'var(--success)',
                              }}
                            />
                          </div>
                          <div className={`budget-label ${cat.total > cat.budget ? 'over' : ''}`}>
                            {language === 'en' ? 'Budget' : 'Presupuesto'}: {fmt(cat.budget)}
                            {cat.total > cat.budget ? ` · ${language === 'en' ? 'Exceeded' : 'Sobrepasado'} ${fmt(cat.total - cat.budget)}` : ''}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
