export default function AdminLayout({ children, onNavigate }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, padding: 16, borderRight: '1px solid #ddd' }}>
        <h2>Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={() => onNavigate('admin.dashboard')}>Dashboard</button>
          <button onClick={() => onNavigate('admin.products')}>Productos</button>
          <button onClick={() => onNavigate('admin.reports')}>Reportes</button>
          <hr />
          <button onClick={() => onNavigate('pos.main')}>Ir a POS</button>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
