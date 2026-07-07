import { NavLink } from 'react-router-dom';
import { useI18n } from '../context/I18nContext';
import './Navbar.css';

export default function Navbar() {
  const { t } = useI18n();

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <span className="logo">💸</span>
        <span className="brand-name">Spendly</span>
      </div>
      <div className="navbar-links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
          {t('navDashboard')}
        </NavLink>
        <NavLink to="/expenses" className={({ isActive }) => isActive ? 'active' : ''}>
          {t('navExpenses')}
        </NavLink>
        <NavLink to="/categories" className={({ isActive }) => isActive ? 'active' : ''}>
          {t('navCategories')}
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => isActive ? 'active' : ''}>
          {t('navSettings')}
        </NavLink>
      </div>
    </nav>
  );
}
