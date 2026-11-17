import { useState } from 'react';
import ConfirmModal from '../components/ConfirmModal';
import '../pages/ADMIN/admin.css';

const NAV_GROUPS = [
  {
    label: 'Principal',
    items: [
      { route: 'admin.dashboard', text: 'Dashboard', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
    ],
  },
  {
    label: 'Catálogo',
    items: [
      { route: 'admin.products', text: 'Productos', icon: 'M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4' },
      { route: 'admin.categories', text: 'Categorías y Marcas', icon: 'M4 6h16M4 12h10M4 18h7' },
      { route: 'admin.attributes', text: 'Tallas y Atributos', icon: 'M7 7h10v10H7z' },
    ],
  },
  {
    label: 'Inventario y Compras',
    items: [
      { route: 'admin.inventory', text: 'Inventario y Almacenes', icon: 'M3 9l9-6 9 6v11H3z' },
      { route: 'admin.purchases', text: 'Proveedores y Compras', icon: 'M6 2h12v20l-6-4-6 4z' },
    ],
  },
  {
    label: 'Ventas y Clientes',
    items: [
      { route: 'admin.sales', text: 'Ventas y Facturas', icon: 'M4 4h16v16H4zM8 9h8M8 13h6' },
      { route: 'admin.layaways', text: 'Apartados y Gift Cards', icon: 'M20 12v8H4v-8M2 7h20v5H2zM12 22V7' },
      { route: 'admin.customers', text: 'Clientes y Fidelidad', icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z' },
      { route: 'admin.discounts', text: 'Descuentos y Cupones', icon: 'M9 15l6-6M9.5 9.5h.01M14.5 14.5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
    ],
  },
  {
    label: 'Finanzas y RRHH',
    items: [
      { route: 'admin.finances', text: 'Cajas y Gastos', icon: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6' },
      { route: 'admin.employees', text: 'Empleados y Turnos', icon: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { route: 'admin.branches', text: 'Sucursales', icon: 'M3 21h18M5 21V7l7-4 7 4v14' },
      { route: 'admin.users', text: 'Usuarios y Roles', icon: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 20a8 8 0 0116 0' },
      { route: 'admin.reports', text: 'Reportes', icon: 'M4 20h16M7 16v-5M12 16V7M17 16v-8' },
      { route: 'admin.settings', text: 'Configuración', icon: 'M12 15a3 3 0 100-6 3 3 0 000 6z' },
      { route: 'pos.main', text: 'Punto de Venta', icon: 'M3 6h18v12H3zM3 10h18M7 15h3', accent: true },
    ],
  },
];

export default function AdminLayout({ children, currentRoute, onNavigate }) {
  const { logout } = useAuthWrapper();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);

  const handleNav = (route) => {
    onNavigate(route);
    setMobileOpen(false);
  };

  const shellClass = [
    'admin-shell',
    collapsed ? 'is-collapsed' : '',
    mobileOpen ? 'is-mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={shellClass}>
      <div
        className="admin-sidebar-backdrop"
        onClick={() => setMobileOpen(false)}
      />

      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-top">
            <div className="admin-brand">
              <h2 className="admin-brand-title">SAF MODA</h2>
              <span className="admin-brand-sub">Administración</span>
            </div>
            <button
              type="button"
              className="admin-collapse-btn"
              onClick={() => setCollapsed((prev) => !prev)}
              aria-label="Alternar menú"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="admin-nav">
            {NAV_GROUPS.map((group) => (
              <div key={group.label}>
                <div className="admin-nav-group-label">{group.label}</div>
                {group.items.map((item) => (
                  <button
                    key={item.route}
                    type="button"
                    className={`admin-nav-btn ${currentRoute === item.route ? 'is-active' : ''} ${item.accent ? 'admin-nav-btn-accent' : ''}`}
                    onClick={() => handleNav(item.route)}
                    title={item.text}
                  >
                    <span className="admin-nav-icon">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                        <path d={item.icon} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                    <span className="admin-nav-text">{item.text}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>

        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="admin-nav-btn"
            onClick={() => setLogoutOpen(true)}
            title="Cerrar Sesión"
          >
            <span className="admin-nav-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="admin-nav-text">Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      <div>
        <div className="admin-mobile-bar">
          <strong className="admin-brand-title">SAF MODA</strong>
          <button
            type="button"
            className="admin-collapse-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <main className="admin-main">{children}</main>
      </div>

      <ConfirmModal
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        eyebrow="Sesión"
        title="¿Cerrar sesión?"
        message="Saldrás del panel administrativo y volverás a la pantalla de inicio."
        confirmLabel="Cerrar Sesión"
        variant="danger"
        onConfirm={() => {
          logout();
          onNavigate('home');
        }}
      />
    </div>
  );
}

import { useAuth } from '../context/AuthContext';
function useAuthWrapper() {
  return useAuth();
}
