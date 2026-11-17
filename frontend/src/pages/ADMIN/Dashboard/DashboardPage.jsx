import { useEffect, useState } from 'react';
import { dashboardService } from '../../../services/admin/dashboardService';

export default function DashboardPage() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    dashboardService
      .getSummary()
      .then((res) => setSummary(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h1>Admin Dashboard</h1>
      {error && <p>Error de conexión: {error}</p>}
      {summary ? (
        <pre>{JSON.stringify(summary, null, 2)}</pre>
      ) : (
        !error && <p>Cargando resumen...</p>
      )}
    </section>
  );
}
