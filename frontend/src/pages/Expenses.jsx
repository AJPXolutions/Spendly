import { useState, useEffect, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  createRecurringExpense,
  deleteExpense,
  deleteRecurringExpense,
  getExpenses,
  getRecurringExpenses,
  importExpenses,
} from '../services/api';
import ExpenseModal from '../components/ExpenseModal';
import ConfirmModal from '../components/ConfirmModal';
import './Expenses.css';

const parseCsvLine = (line) => {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  result.push(cur);
  return result;
};

export default function Expenses() {
  const { categories, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear } = useApp();
  const { language, locale, t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [jumpPage, setJumpPage] = useState('1');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [recurring, setRecurring] = useState([]);
  const [recurringForm, setRecurringForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    frequency: 'monthly',
    start_date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [recurringDeleteTarget, setRecurringDeleteTarget] = useState(null);
  const fileInputRef = useRef(null);

  const years = [];
  const thisYear = new Date().getFullYear();
  for (let y = thisYear; y >= thisYear - 3; y -= 1) years.push(y);

  const currency = user?.currency || 'USD';
  const fmt = (n) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n);
  const MONTHS = language === 'en'
    ? ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    : ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const loadRecurring = useCallback(async () => {
    const data = await getRecurringExpenses();
    setRecurring(data);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month: selectedMonth, year: selectedYear, page, limit: pageSize };
      if (filterCat) params.category_id = filterCat;
      if (search.trim()) params.q = search.trim();
      const data = await getExpenses(params);
      setExpenses(data.items || []);
      setTotalItems(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
      setJumpPage(String(data.pagination?.page || 1));
      if ((data.pagination?.totalPages || 1) < page) setPage(data.pagination?.totalPages || 1);
      await loadRecurring();
    } catch (e) {
      setExpenses([]);
      setTotalItems(0);
      setTotalPages(1);
      setJumpPage('1');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, page, pageSize, filterCat, search, loadRecurring]);

  useEffect(() => { load(); }, [load]);

  const requestDelete = (expense) => setDeleteTarget(expense);
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.success(language === 'en' ? 'Expense deleted.' : 'Gasto eliminado.');
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (exp) => { setEditing(exp); setShowModal(true); };
  const handleAdd = () => { setEditing(null); setShowModal(true); };
  const handleSaved = () => { setShowModal(false); load(); };
  const handleJump = () => {
    const parsed = parseInt(jumpPage, 10);
    if (Number.isNaN(parsed)) return;
    setPage(Math.min(Math.max(parsed, 1), totalPages));
  };

  const csvEscape = (value) => {
    const s = value == null ? '' : String(value);
    if (s.includes('"') || s.includes(',') || s.includes('\n')) return `"${s.replaceAll('"', '""')}"`;
    return s;
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const params = { month: selectedMonth, year: selectedYear, all: 1 };
      if (filterCat) params.category_id = filterCat;
      if (search.trim()) params.q = search.trim();
      const data = await getExpenses(params);
      const rows = data.items || [];
      const header = ['date', 'description', 'category', 'amount', 'notes'];
      const lines = rows.map((r) => [r.date, r.description, r.category_name, Number(r.amount).toFixed(2), r.notes || '']);
      const csv = [header, ...lines].map((line) => line.map(csvEscape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `gastos-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(language === 'en' ? 'CSV exported.' : 'CSV exportado.');
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (file) => {
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) {
      toast.error(language === 'en' ? 'CSV file has no rows.' : 'El CSV no tiene filas.');
      return;
    }
    const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idxDate = header.indexOf('date') >= 0 ? header.indexOf('date') : header.indexOf('fecha');
    const idxDesc = header.indexOf('description') >= 0 ? header.indexOf('description') : header.indexOf('descripción');
    const idxCat = header.indexOf('category') >= 0 ? header.indexOf('category') : header.indexOf('categoría');
    const idxAmount = header.indexOf('amount') >= 0 ? header.indexOf('amount') : header.indexOf('monto');
    const idxNotes = header.indexOf('notes') >= 0 ? header.indexOf('notes') : header.indexOf('notas');
    if (idxDate < 0 || idxDesc < 0 || idxCat < 0 || idxAmount < 0) {
      toast.error(language === 'en' ? 'CSV headers are invalid.' : 'Cabeceras CSV inválidas.');
      return;
    }
    const rows = lines.slice(1).map((line) => {
      const cols = parseCsvLine(line);
      return {
        date: cols[idxDate],
        description: cols[idxDesc],
        category: cols[idxCat],
        amount: cols[idxAmount],
        notes: idxNotes >= 0 ? cols[idxNotes] : '',
      };
    });

    setImporting(true);
    try {
      const result = await importExpenses(rows);
      toast.success(
        language === 'en'
          ? `Imported ${result.imported} rows (${result.failed} failed).`
          : `Importadas ${result.imported} filas (${result.failed} fallidas).`
      );
      load();
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitRecurring = async () => {
    if (!recurringForm.description || !recurringForm.amount || !recurringForm.category_id || !recurringForm.start_date) {
      toast.error(language === 'en' ? 'Complete recurring fields.' : 'Completa los campos de recurrente.');
      return;
    }
    await createRecurringExpense(recurringForm);
    setRecurringForm({
      description: '',
      amount: '',
      category_id: '',
      frequency: 'monthly',
      start_date: new Date().toISOString().slice(0, 10),
      notes: '',
    });
    toast.success(language === 'en' ? 'Recurring expense saved.' : 'Gasto recurrente guardado.');
    load();
  };

  const deleteRecurring = async () => {
    if (!recurringDeleteTarget) return;
    await deleteRecurringExpense(recurringDeleteTarget.id);
    setRecurringDeleteTarget(null);
    toast.success(language === 'en' ? 'Recurring expense deleted.' : 'Gasto recurrente eliminado.');
    load();
  };

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="expenses-page">
      <div className="page-header">
        <h1>{language === 'en' ? 'Expenses' : 'Gastos'}</h1>
        <div className="header-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => handleImportFile(e.target.files?.[0])}
          />
          <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={importing}>
            {importing ? (language === 'en' ? 'Importing…' : 'Importando…') : `⬆️ ${t('importCsv')}`}
          </button>
          <button className="btn btn-ghost" onClick={exportCsv} disabled={exporting}>
            {exporting ? (language === 'en' ? 'Exporting…' : 'Exportando…') : (language === 'en' ? '⬇️ Export CSV' : '⬇️ Exportar CSV')}
          </button>
          <button className="btn btn-primary" onClick={handleAdd}>{language === 'en' ? '＋ New expense' : '＋ Nuevo gasto'}</button>
        </div>
      </div>

      <div className="card recurring-card">
        <h2 className="section-title">{t('recurringTitle')}</h2>
        <div className="filters">
          <input
            placeholder={language === 'en' ? 'Description' : 'Descripción'}
            value={recurringForm.description}
            onChange={(e) => setRecurringForm((prev) => ({ ...prev, description: e.target.value }))}
            style={{ maxWidth: 260 }}
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder={language === 'en' ? 'Amount' : 'Monto'}
            value={recurringForm.amount}
            onChange={(e) => setRecurringForm((prev) => ({ ...prev, amount: e.target.value }))}
            style={{ maxWidth: 150 }}
          />
          <select
            value={recurringForm.category_id}
            onChange={(e) => setRecurringForm((prev) => ({ ...prev, category_id: e.target.value }))}
            style={{ maxWidth: 190 }}
          >
            <option value="">{language === 'en' ? 'Category' : 'Categoría'}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
          <select
            value={recurringForm.frequency}
            onChange={(e) => setRecurringForm((prev) => ({ ...prev, frequency: e.target.value }))}
            style={{ maxWidth: 140 }}
          >
            <option value="weekly">{t('frequencyWeekly')}</option>
            <option value="monthly">{t('frequencyMonthly')}</option>
          </select>
          <input
            type="date"
            value={recurringForm.start_date}
            onChange={(e) => setRecurringForm((prev) => ({ ...prev, start_date: e.target.value }))}
            style={{ maxWidth: 165 }}
          />
          <button className="btn btn-primary" onClick={submitRecurring}>
            {language === 'en' ? 'Add recurring' : 'Agregar recurrente'}
          </button>
        </div>
        <div className="recurring-list">
          {recurring.length === 0 ? (
            <div className="summary-count">{t('noRecurring')}</div>
          ) : recurring.map((item) => (
            <div key={item.id} className="recurring-item">
              <div>
                <strong>{item.description}</strong> · {fmt(item.amount)} · {item.frequency === 'weekly' ? t('frequencyWeekly') : t('frequencyMonthly')}
              </div>
              <button className="btn btn-danger" onClick={() => setRecurringDeleteTarget(item)}>🗑️</button>
            </div>
          ))}
        </div>
      </div>

      <div className="filters card">
        <input
          placeholder={language === 'en' ? '🔍 Search description…' : '🔍 Buscar descripción…'}
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ maxWidth: 280 }}
        />
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1); }} style={{ maxWidth: 180 }}>
          <option value="">{language === 'en' ? 'All categories' : 'Todas las categorías'}</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
          ))}
        </select>
        <select value={selectedMonth} onChange={e => { setSelectedMonth(Number(e.target.value)); setPage(1); }} style={{ maxWidth: 150 }}>
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={selectedYear} onChange={e => { setSelectedYear(Number(e.target.value)); setPage(1); }} style={{ maxWidth: 100 }}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ maxWidth: 120 }}>
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size} / {language === 'en' ? 'page' : 'pág'}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="loading">{language === 'en' ? 'Loading…' : 'Cargando…'}</div>
      ) : expenses.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🧾</div>
          <p>{language === 'en' ? 'No expenses for this period.' : 'No hay gastos para este período.'}</p>
        </div>
      ) : (
        <>
          <div className="expenses-summary">
            <span>
              {totalItems} {language === 'en' ? `expense${totalItems !== 1 ? 's' : ''} total · page ${page} of ${totalPages}` : `gasto${totalItems !== 1 ? 's' : ''} en total · página ${page} de ${totalPages}`}
            </span>
            <span className="total">{language === 'en' ? 'Total (page)' : 'Total (página)'}: {fmt(total)}</span>
          </div>
          <div className="expenses-list">
            {expenses.map(exp => (
              <div key={exp.id} className="expense-item card">
                <div className="exp-cat" style={{ background: exp.category_color + '22', color: exp.category_color }}>
                  {exp.category_icon}
                </div>
                <div className="exp-info">
                  <div className="exp-desc">{exp.description}</div>
                  <div className="exp-meta">
                    <span className="badge" style={{ background: exp.category_color + '33', color: exp.category_color }}>
                      {exp.category_name}
                    </span>
                    <span className="exp-date">{new Date(exp.date + 'T00:00:00').toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                    {exp.notes && <span className="exp-notes">📝 {exp.notes}</span>}
                  </div>
                </div>
                <div className="exp-amount">{fmt(exp.amount)}</div>
                <div className="exp-actions">
                  <button className="btn btn-ghost" onClick={() => handleEdit(exp)}>✏️</button>
                  <button className="btn btn-danger" onClick={() => requestDelete(exp)}>🗑️</button>
                </div>
              </div>
            ))}
          </div>
          <div className="pagination card">
            <button
              className="btn btn-ghost"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              {language === 'en' ? '← Previous' : '← Anterior'}
            </button>
            <span className="pagination-label">{language === 'en' ? `Page ${page} of ${totalPages}` : `Página ${page} de ${totalPages}`}</span>
            <button
              className="btn btn-ghost"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              {language === 'en' ? 'Next →' : 'Siguiente →'}
            </button>
            <div className="jump-box">
              <input
                type="number"
                min="1"
                max={Math.max(totalPages, 1)}
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
              />
              <button className="btn btn-ghost" onClick={handleJump}>{language === 'en' ? 'Go' : 'Ir'}</button>
            </div>
          </div>
        </>
      )}

      {showModal && (
        <ExpenseModal
          expense={editing}
          onClose={() => setShowModal(false)}
          onSaved={handleSaved}
        />
      )}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={language === 'en' ? 'Delete expense' : 'Eliminar gasto'}
        message={deleteTarget ? (language === 'en' ? `Delete "${deleteTarget.description}"?` : `¿Seguro que deseas eliminar "${deleteTarget.description}"?`) : ''}
        confirmText={language === 'en' ? 'Yes, delete' : 'Sí, eliminar'}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
      <ConfirmModal
        open={Boolean(recurringDeleteTarget)}
        title={language === 'en' ? 'Delete recurring expense' : 'Eliminar gasto recurrente'}
        message={recurringDeleteTarget ? recurringDeleteTarget.description : ''}
        confirmText={language === 'en' ? 'Yes, delete' : 'Sí, eliminar'}
        onCancel={() => setRecurringDeleteTarget(null)}
        onConfirm={deleteRecurring}
      />
    </div>
  );
}
