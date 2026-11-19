import { useEffect, useState } from 'react';
import { cashRegisterService } from '../../../services/pos/cashRegisterService';

export default function CashRegisterPage({ onNavigate }) {
  const [session, setSession] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    cashRegisterService
      .getCurrent()
      .then((res) => setSession(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <div className="pos-page-head">
        <div>
          <span className="pos-eyebrow">Punto de Venta</span>
          <h1>Caja Registradora</h1>
          <p className="pos-page-sub">Control de apertura, arqueo y cierre de turno.</p>
        </div>
        {onNavigate && (
          <button type="button" className="pos-btn" onClick={() => onNavigate('pos.main')}>
            Volver al Inicio POS
          </button>
        )}
      </div>

      <div className="pos-panel">
        {error && <p>Error de conexión: {error}</p>}
        {session ? (
          <pre className="pos-pre">{JSON.stringify(session, null, 2)}</pre>
        ) : (
          !error && <p>Verificando estado de caja...</p>
        )}
      </div>
    </section>
  );
}
