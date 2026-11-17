import { useEffect, useState } from 'react';
import { saleService } from '../../../services/pos/saleService';

export default function PosPage() {
  const [initData, setInitData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    saleService
      .getInitData()
      .then((res) => setInitData(res.data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h1>Punto de Venta (POS)</h1>
      {error && <p>Error de conexión: {error}</p>}
      {initData ? (
        <pre>{JSON.stringify(initData, null, 2)}</pre>
      ) : (
        !error && <p>Inicializando POS...</p>
      )}
    </section>
  );
}
