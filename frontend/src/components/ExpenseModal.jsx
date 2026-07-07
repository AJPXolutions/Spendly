import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { createExpense, updateExpense } from '../services/api';
import './ExpenseModal.css';

function toLocalDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${y}-${m}-${d}`;
}

export default function ExpenseModal({ expense, onClose, onSaved }) {
  const { categories } = useApp();
  const { language } = useI18n();
  const toast = useToast();
  const [form, setForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (expense) {
      setForm({
        description: expense.description,
        amount: expense.amount,
        category_id: expense.category_id,
        date: toLocalDate(expense.date),
        notes: expense.notes || '',
      });
    } else if (categories.length > 0) {
      setForm(f => ({ ...f, category_id: categories[0].id }));
    }
  }, [expense, categories]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.description.trim() || !form.amount || !form.category_id || !form.date) {
      return setError(language === 'en' ? 'Please complete all required fields.' : 'Completa todos los campos obligatorios.');
    }
    setSaving(true);
    try {
      if (expense) {
        await updateExpense(expense.id, form);
        toast.success(language === 'en' ? 'Expense updated.' : 'Gasto actualizado.');
      } else {
        await createExpense(form);
        toast.success(language === 'en' ? 'Expense saved.' : 'Gasto guardado.');
      }
      onSaved();
    } catch (e) {
      setError(e.response?.data?.error || (language === 'en' ? 'Error while saving' : 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{expense ? (language === 'en' ? '✏️ Edit expense' : '✏️ Editar gasto') : (language === 'en' ? '➕ New expense' : '➕ Nuevo gasto')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{language === 'en' ? 'Description *' : 'Descripción *'}</label>
            <input
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder={language === 'en' ? 'Eg: Lunch at restaurant' : 'Ej: Almuerzo en restaurante'}
              maxLength={120}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{language === 'en' ? 'Amount *' : 'Monto *'}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="form-group">
              <label>{language === 'en' ? 'Date *' : 'Fecha *'}</label>
              <input
                type="date"
                value={form.date}
                onChange={e => set('date', e.target.value)}
              />
            </div>
          </div>
          <div className="form-group">
            <label>{language === 'en' ? 'Category *' : 'Categoría *'}</label>
            <select value={form.category_id} onChange={e => set('category_id', e.target.value)}>
              <option value="">{language === 'en' ? 'Select...' : 'Selecciona...'}</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>{language === 'en' ? 'Notes' : 'Notas'}</label>
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              placeholder={language === 'en' ? 'Optional' : 'Opcional'}
              style={{ resize: 'vertical' }}
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>{language === 'en' ? 'Cancel' : 'Cancelar'}</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? (language === 'en' ? 'Saving…' : 'Guardando…') : (expense ? (language === 'en' ? 'Update' : 'Actualizar') : (language === 'en' ? 'Save' : 'Guardar'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
