import { useState } from 'react';
import AdminLayout from '../layouts/AdminLayout';
import PosLayout from '../layouts/PosLayout';
import HomeLayout from '../layouts/HomeLayout';
import ShopLayout from '../layouts/ShopLayout';
import DashboardPage from '../pages/ADMIN/Dashboard/DashboardPage';
import ProductsPage from '../pages/ADMIN/Products/ProductsPage';
import ReportsPage from '../pages/ADMIN/Reports/ReportsPage';
import PosPage from '../pages/POS/PointOfSale/PosPage';
import CashRegisterPage from '../pages/POS/CashRegister/CashRegisterPage';
import HomePage from '../pages/HOME/HomePage';
import ShopPage from '../pages/SHOP/ShopPage';

export default function AppRouter() {
  const [route, setRoute] = useState('home');

  if (route === 'home') {
    return (
      <HomeLayout onNavigate={setRoute}>
        <HomePage />
      </HomeLayout>
    );
  }

  if (route === 'shop') {
    return (
      <ShopLayout onNavigate={setRoute}>
        <ShopPage />
      </ShopLayout>
    );
  }

  if (route.startsWith('pos.')) {
    return (
      <PosLayout onNavigate={setRoute}>
        {route === 'pos.main' && <PosPage />}
        {route === 'pos.cash-register' && <CashRegisterPage />}
      </PosLayout>
    );
  }

  return (
    <AdminLayout onNavigate={setRoute}>
      {route === 'admin.dashboard' && <DashboardPage />}
      {route === 'admin.products' && <ProductsPage />}
      {route === 'admin.reports' && <ReportsPage />}
    </AdminLayout>
  );
}
