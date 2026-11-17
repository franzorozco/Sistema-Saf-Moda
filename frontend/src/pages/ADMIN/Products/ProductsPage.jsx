import { useEffect, useState } from 'react';
import { productService } from '../../../services/admin/productService';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    productService
      .getAll()
      .then((res) => setProducts(res.data || []))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <section>
      <h1>Admin - Productos</h1>
      {error && <p>Error de conexión: {error}</p>}
      <p>Total productos: {products.length}</p>
    </section>
  );
}
