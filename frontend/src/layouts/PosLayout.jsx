import '../pages/POS/pos.css';

const POS_NAV_ITEMS = [
  { route: 'pos.main', label: 'Inicio' },
  { route: 'pos.sell', label: 'Vender' },
  { route: 'pos.cash-register', label: 'Caja' },
  { route: 'pos.inventory', label: 'Inventario' },
  { route: 'pos.customers', label: 'Clientes' },
];

export default function PosLayout({ children, currentRoute, onNavigate }) {
  return (
    <div className="pos-shell">
      <header className="pos-topbar">
        <div className="pos-topbar-left">
          <button
            type="button"
            className="pos-brand-btn"
            onClick={() => onNavigate('pos.main')}
          >
            <span className="pos-brand-title">SAF MODA</span>
            <span className="pos-brand-tag">POS</span>
          </button>

          <nav className="pos-topnav" aria-label="Navegación rápida POS">
            {POS_NAV_ITEMS.map((item) => (
              <button
                key={item.route}
                type="button"
                className={`pos-nav-btn ${currentRoute === item.route ? 'is-active' : ''}`}
                onClick={() => onNavigate(item.route)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pos-topbar-right">
          <button
            type="button"
            className="pos-btn"
            onClick={() => onNavigate('admin.dashboard')}
          >
            Ir a Admin
          </button>
        </div>
      </header>

      <main className="pos-main">{children}</main>
    </div>
  );
}
