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
import PosPage from '../pages/POS/PointOfSale/PosPage';
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
  'pos.cash-register': '/pos/caja',
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
    return (
      <PosLayout onNavigate={navigate}>
        {route === 'pos.main' && <PosPage />}
        {route === 'pos.cash-register' && <CashRegisterPage />}
      </PosLayout>
    );
  }

  const adminHandled = [
    'admin.dashboard',
    'admin.products',
    'admin.categories',
    'admin.attributes',
    'admin.reports',
  ];

  return (
    <AdminLayout currentRoute={route} onNavigate={navigate}>
      {route === 'admin.dashboard' && <DashboardPage />}
      {route === 'admin.products' && <ProductsPage />}
      {route === 'admin.categories' && <CategoriesPage />}
      {route === 'admin.attributes' && <AttributesPage />}
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
