import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useI18n } from '../context/I18nContext';
import { useToast } from '../context/ToastContext';
import { createCategory, updateCategory, deleteCategory } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import './Categories.css';

const ICONS = ['💰','🍔','🚌','🎮','🏥','🏠','👕','📚','📦','✈️','💊','🎵','🐾','🛒','⚡','📱','🎂','🍕','🚗','🎓'];
const COLORS = ['#6366f1','#f97316','#3b82f6','#a855f7','#22c55e','#eab308','#ec4899','#14b8a6','#6b7280','#ef4444','#f59e0b','#10b981'];

export default function Categories() {
  const { categories, refreshCategories } = useApp();
  const { user } = useAuth();
  const { language, locale } = useI18n();
  const toast = useToast();
  const currency = user?.currency || 'USD';
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', icon: '💰', budget: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const openAdd = () => { setEditing(null); setForm({ name: '', color: '#6366f1', icon: '💰', budget: '' }); setError(''); setShowForm(true); };
  const openEdit = (cat) => { setEditing(cat); setForm({ name: cat.name, color: cat.color, icon: cat.icon, budget: cat.budget ?? '' }); setError(''); setShowForm(true); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return setError(language === 'en' ? 'Name is required.' : 'El nombre es obligatorio.');
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast.success(language === 'en' ? `Category "${form.name}" updated.` : `Categoría "${form.name}" actualizada.`);
      } else {
        await createCategory(form);
        toast.success(language === 'en' ? `Category "${form.name}" created.` : `Categoría "${form.name}" creada.`);
      }
      await refreshCategories();
      setShowForm(false);
    } catch (e) {
      setError(e.response?.data?.error || (language === 'en' ? 'Error while saving' : 'Error al guardar'));
    } finally {
      setSaving(false);
    }
  };

  const requestDelete = (cat) => setDeleteTarget(cat);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCategory(deleteTarget.id);
      toast.success(language === 'en' ? `Category "${deleteTarget.name}" deleted.` : `Categoría "${deleteTarget.name}" eliminada.`);
      setDeleteTarget(null);
      await refreshCategories();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="categories-page">
      <div className="page-header">
        <h1>{language === 'en' ? 'Categories' : 'Categorías'}</h1>
        <button className="btn btn-primary" onClick={openAdd}>{language === 'en' ? '＋ New category' : '＋ Nueva categoría'}</button>
      </div>

      <div className="categories-grid">
        {categories.map(cat => (
          <div key={cat.id} className="cat-card card" style={{ borderLeft: `4px solid ${cat.color}` }}>
            <div className="cat-card-icon" style={{ background: cat.color + '22' }}>{cat.icon}</div>
            <div className="cat-card-content">
              <div className="cat-card-name">{cat.name}</div>
              {cat.budget != null && <div className="cat-card-budget">{language === 'en' ? 'Budget' : 'Presupuesto'}: {new Intl.NumberFormat(locale, { style: 'currency', currency }).format(Number(cat.budget))}</div>}
            </div>
            <div className="cat-card-actions">
              <button className="btn btn-ghost" onClick={() => openEdit(cat)}>✏️</button>
              <button className="btn btn-danger" onClick={() => requestDelete(cat)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal">
            <h2>{editing ? (language === 'en' ? '✏️ Edit category' : '✏️ Editar categoría') : (language === 'en' ? '➕ New category' : '➕ Nueva categoría')}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>{language === 'en' ? 'Name *' : 'Nombre *'}</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={language === 'en' ? 'Eg: Travel' : 'Ej: Viajes'} maxLength={50} />
              </div>

              <div className="form-group">
                <label>{language === 'en' ? 'Icon' : 'Ícono'}</label>
                <div className="icon-picker">
                  {ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      className={`icon-btn ${form.icon === ic ? 'selected' : ''}`}
                      onClick={() => set('icon', ic)}
                    >{ic}</button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>{language === 'en' ? 'Color' : 'Color'}</label>
                <div className="color-picker">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`color-btn ${form.color === c ? 'selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => set('color', c)}
                    />
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>{language === 'en' ? 'Monthly budget (optional)' : 'Presupuesto mensual (opcional)'}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.budget}
                  onChange={(e) => set('budget', e.target.value)}
                  placeholder={language === 'en' ? 'Eg: 250' : 'Ej: 250'}
                />
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>{error}</p>}
              <div className="form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)}>{language === 'en' ? 'Cancel' : 'Cancelar'}</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (language === 'en' ? 'Saving…' : 'Guardando…') : (editing ? (language === 'en' ? 'Update' : 'Actualizar') : (language === 'en' ? 'Create' : 'Crear'))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title={language === 'en' ? 'Delete category' : 'Eliminar categoría'}
        message={deleteTarget ? (language === 'en' ? `Delete "${deleteTarget.name}"? Its expenses will also be deleted.` : `¿Eliminar "${deleteTarget.name}"? También se eliminarán sus gastos.`) : ''}
        confirmText={language === 'en' ? 'Yes, delete' : 'Sí, eliminar'}
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
