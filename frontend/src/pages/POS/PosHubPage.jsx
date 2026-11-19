const POS_MODULES = [
  {
    route: 'pos.sell',
    title: 'Vender',
    description: 'Registrar nuevas ventas, buscar prendas por SKU o nombre, aplicar descuentos y cobrar.',
    badge: 'Operación Principal',
    featured: true,
    icon: (
      <>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </>
    ),
  },
  {
    route: 'pos.cash-register',
    title: 'Caja Registradora',
    description: 'Abrir o cerrar turno de caja, controlar movimientos de efectivo y realizar arqueo.',
    badge: 'Turno de Caja',
    featured: false,
    icon: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </>
    ),
  },
  {
    route: 'pos.inventory',
    title: 'Inventario',
    description: 'Consultar disponibilidad de tallas, colores, precios y stock en tu sucursal.',
    badge: 'Consulta Rápida',
    featured: false,
    icon: (
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
  },
  {
    route: 'pos.customers',
    title: 'Clientes',
    description: 'Buscar clientes frecuentes, registrar nuevos compradores y revisar crédito o puntos.',
    badge: 'Fidelidad',
    featured: false,
    icon: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </>
    ),
  },
  {
    route: 'pos.layaways',
    title: 'Apartados',
    description: 'Gestionar prendas reservadas, registrar abonos y completar entregas pendientes.',
    badge: 'Reservas',
    featured: false,
    icon: (
      <>
        <path d="M20 12v8H4v-8" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
      </>
    ),
  },
  {
    route: 'pos.sales',
    title: 'Historial y Cambios',
    description: 'Revisar ventas recientes del día, reimprimir tickets o gestionar devoluciones.',
    badge: 'Comprobantes',
    featured: false,
    icon: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </>
    ),
  },
];

export default function PosHubPage({ onNavigate }) {
  return (
    <section className="pos-hub-wrap" aria-label="Menú principal del Punto de Venta">
      <div className="pos-hub-hero">
        <span className="pos-eyebrow">Punto de Venta · Saf Moda</span>
        <h1>Panel de Atención en Tienda</h1>
        <p className="pos-hub-sub">
          Selecciona el módulo con el que deseas trabajar para comenzar tu jornada en sucursal.
        </p>
      </div>

      <div className="pos-hub-grid">
        {POS_MODULES.map((mod) => (
          <button
            key={mod.route}
            type="button"
            className={`pos-hub-card ${mod.featured ? 'is-featured' : ''}`}
            onClick={() => onNavigate(mod.route)}
          >
            <div className="pos-hub-card-top">
              <span className="pos-hub-icon-box" aria-hidden="true">
                <svg
                  className="pos-hub-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {mod.icon}
                </svg>
              </span>

              <svg
                className="pos-hub-arrow"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </div>

            <div>
              <h2 className="pos-hub-title">{mod.title}</h2>
              <p className="pos-hub-desc">{mod.description}</p>
            </div>

            <span className="pos-hub-badge">{mod.badge}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
