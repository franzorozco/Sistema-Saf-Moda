import { useEffect, useState } from 'react';
import { cashRegisterService } from '../../../services/pos/cashRegisterService';

export default function CashRegisterPage() {
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
      <h1>POS - Caja Registradora</h1>
      {error && <p>Error de conexión: {error}</p>}
      {session ? (
        <pre>{JSON.stringify(session, null, 2)}</pre>
      ) : (
        !error && <p>Verificando estado de caja...</p>
      )}
    </section>
  );
}
