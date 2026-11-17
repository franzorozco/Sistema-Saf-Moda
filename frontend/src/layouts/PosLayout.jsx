export default function PosLayout({ children, onNavigate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ display: 'flex', gap: 12, padding: 12, borderBottom: '1px solid #ddd' }}>
        <strong>POS</strong>
        <button onClick={() => onNavigate('pos.main')}>Punto de Venta</button>
        <button onClick={() => onNavigate('pos.cash-register')}>Caja</button>
        <button onClick={() => onNavigate('admin.dashboard')} style={{ marginLeft: 'auto' }}>
          Ir a Admin
        </button>
      </header>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
