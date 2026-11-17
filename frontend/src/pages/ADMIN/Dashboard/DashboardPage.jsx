import { useEffect, useState } from 'react';
import { dashboardService } from '../../../services/admin/dashboardService';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    dashboardService
      .getSummary()
      .then((res) => setSummary(res.data))
      .catch(() => setSummary(null));
  }, []);

  return (
    <>
      <header className="admin-header">
        <div>
          <h1>Dashboard General</h1>
          <p>Resumen operativo de SafModa: ventas, inventario y cajas.</p>
        </div>
      </header>

      <section className="admin-kpi-grid">
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Ventas Hoy</span>
          <strong className="admin-kpi-value">
            Bs. {summary?.total_sales_today ?? 0}
          </strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Pedidos Hoy</span>
          <strong className="admin-kpi-value">
            {summary?.total_orders_today ?? 0}
          </strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Stock Bajo</span>
          <strong className="admin-kpi-value">
            {summary?.low_stock_products ?? 0}
          </strong>
        </article>
        <article className="admin-kpi-card">
          <span className="admin-kpi-label">Cajas Activas</span>
          <strong className="admin-kpi-value">
            {summary?.active_cash_registers ?? 0}
          </strong>
        </article>
      </section>
    </>
  );
}
