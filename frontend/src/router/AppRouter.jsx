import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AdminLayout from '../layouts/AdminLayout';
import PosLayout from '../layouts/PosLayout';
import HomeLayout from '../layouts/HomeLayout';
import ShopLayout from '../layouts/ShopLayout';
import DashboardPage from '../pages/ADMIN/Dashboard/DashboardPage';
import ProductsPage from '../pages/ADMIN/Products/ProductsPage';
import ReportsPage from '../pages/ADMIN/Reports/ReportsPage';
import CategoriesPage from '../pages/ADMIN/Catalog/CategoriesPage';
import AttributesPage from '../pages/ADMIN/Catalog/AttributesPage';
import UsersPage from '../pages/ADMIN/Users/UsersPage';
import EmployeesPage from '../pages/ADMIN/Employees/EmployeesPage';
import CustomersPage from '../pages/ADMIN/Customers/CustomersPage';
import InventoryPage from '../pages/ADMIN/Inventory/InventoryPage';
import PurchasesPage from '../pages/ADMIN/Purchases/PurchasesPage';
import PosHubPage from '../pages/POS/PosHubPage';
import PosPage from '../pages/POS/PointOfSale/PosPage';
import PosInventoryPage from '../pages/POS/Inventory/PosInventoryPage';
import CashRegisterPage from '../pages/POS/CashRegister/CashRegisterPage';
import HomePage from '../pages/HOME/HomePage';
import LoginPage from '../pages/HOME/LoginPage';
import ShopPage from '../pages/SHOP/ShopPage';

const ROUTE_TO_PATH = {
  home: '/',
  login: '/login',
  shop: '/shop',
  'admin.dashboard': '/dashboard',
  'admin.products': '/dashboard/productos',
  'admin.categories': '/dashboard/categorias',
  'admin.attributes': '/dashboard/atributos',
  'admin.inventory': '/dashboard/inventario',
  'admin.purchases': '/dashboard/compras',
  'admin.sales': '/dashboard/ventas',
  'admin.layaways': '/dashboard/apartados',
  'admin.customers': '/dashboard/clientes',
  'admin.discounts': '/dashboard/descuentos',
  'admin.finances': '/dashboard/finanzas',
  'admin.employees': '/dashboard/empleados',
  'admin.branches': '/dashboard/sucursales',
  'admin.users': '/dashboard/usuarios',
  'admin.reports': '/dashboard/reportes',
  'admin.settings': '/dashboard/configuracion',
  'pos.main': '/pos',
  'pos.sell': '/pos/vender',
  'pos.cash-register': '/pos/caja',
  'pos.inventory': '/pos/inventario',
  'pos.customers': '/pos/clientes',
  'pos.layaways': '/pos/apartados',
  'pos.sales': '/pos/ventas',
};

const PATH_TO_ROUTE = Object.fromEntries(
  Object.entries(ROUTE_TO_PATH).map(([route, path]) => [path, route])
);

function getRouteFromPath(pathname) {
  return PATH_TO_ROUTE[pathname] || 'home';
}

export default function AppRouter() {
  const { isAuthenticated } = useAuth();
  const [route, setRoute] = useState(() => getRouteFromPath(window.location.pathname));

  const navigate = (nextRoute) => {
    const targetPath = ROUTE_TO_PATH[nextRoute] || '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, '', targetPath);
    }
    setRoute(nextRoute);
  };

  useEffect(() => {
    const onPopState = () => {
      setRoute(getRouteFromPath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const isProtected = route.startsWith('admin.') || route.startsWith('pos.');
    if (isProtected && !isAuthenticated) {
      navigate('login');
    }
  }, [route, isAuthenticated]);

  if (route === 'home') {
    return (
      <HomeLayout onNavigate={navigate}>
        <HomePage onNavigate={navigate} />
      </HomeLayout>
    );
  }

  if (route === 'login') {
    return (
      <HomeLayout onNavigate={navigate}>
        <LoginPage onNavigate={navigate} />
      </HomeLayout>
    );
  }

  if (route === 'shop') {
    return (
      <ShopLayout onNavigate={navigate}>
        <ShopPage />
      </ShopLayout>
    );
  }

  if (route.startsWith('pos.')) {
    const posModuleTitles = {
      'pos.customers': { title: 'Clientes en Punto de Venta', desc: 'Aquí podrás buscar clientes, registrar nuevos compradores y revisar sus puntos o saldo.' },
      'pos.layaways': { title: 'Apartados y Reservas', desc: 'Aquí podrás gestionar prendas apartadas y registrar abonos en caja.' },
      'pos.sales': { title: 'Historial y Cambios', desc: 'Aquí podrás consultar ventas emitidas, reimprimir comprobantes y procesar cambios.' },
    };

    return (
      <PosLayout currentRoute={route} onNavigate={navigate}>
        {route === 'pos.main' && <PosHubPage onNavigate={navigate} />}
        {route === 'pos.sell' && <PosPage onNavigate={navigate} />}
        {route === 'pos.inventory' && <PosInventoryPage onNavigate={navigate} />}
        {route === 'pos.cash-register' && <CashRegisterPage onNavigate={navigate} />}
        {posModuleTitles[route] && (
          <section>
            <div className="pos-page-head">
              <div>
                <span className="pos-eyebrow">Punto de Venta</span>
                <h1>{posModuleTitles[route].title}</h1>
              </div>
              <button type="button" className="pos-btn" onClick={() => navigate('pos.main')}>
                Volver al Inicio POS
              </button>
            </div>
            <div className="pos-panel pos-empty-module">
              <p>{posModuleTitles[route].desc}</p>
              <button type="button" className="pos-btn pos-btn-primary" onClick={() => navigate('pos.main')}>
                Volver a Opciones del POS
              </button>
            </div>
          </section>
        )}
      </PosLayout>
    );
  }

  const adminHandled = [
    'admin.dashboard',
    'admin.products',
    'admin.categories',
    'admin.attributes',
    'admin.inventory',
    'admin.purchases',
    'admin.customers',
    'admin.employees',
    'admin.users',
    'admin.reports',
  ];

  return (
    <AdminLayout currentRoute={route} onNavigate={navigate}>
      {route === 'admin.dashboard' && <DashboardPage />}
      {route === 'admin.products' && <ProductsPage />}
      {route === 'admin.categories' && <CategoriesPage />}
      {route === 'admin.attributes' && <AttributesPage />}
      {route === 'admin.inventory' && <InventoryPage />}
      {route === 'admin.purchases' && <PurchasesPage />}
      {route === 'admin.customers' && <CustomersPage />}
      {route === 'admin.employees' && <EmployeesPage />}
      {route === 'admin.users' && <UsersPage />}
      {route === 'admin.reports' && <ReportsPage />}
      {!adminHandled.includes(route) && (
        <section className="admin-panel">
          <div className="admin-panel-header">
            <h2>Módulo en preparación</h2>
          </div>
          <p>Ruta activa: {ROUTE_TO_PATH[route]}</p>
        </section>
      )}
    </AdminLayout>
  );
}
