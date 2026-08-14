import { createBrowserRouter } from 'react-router-dom'
import Layout from '@/components/Layout/Layout'
import LoginPage from '@/pages/Auth/LoginPage'
import DashboardPage from '@/pages/Dashboard/DashboardPage'
import POSPage from '@/pages/POS/POSPage'
import ProductsPage from '@/pages/Products/ProductsPage'
import InvoicesPage from '@/pages/Invoices/InvoicesPage'
import InvoiceDetailPage from '@/pages/Invoices/InvoiceDetailPage'
import CustomersPage from '@/pages/Customers/CustomersPage'
import SuppliersPage from '@/pages/Suppliers/SuppliersPage'
import PurchasesPage from '@/pages/Purchases/PurchasesPage'
import ReturnsPage from '@/pages/Returns/ReturnsPage'
import ReportsPage from '@/pages/Reports/ReportsPage'
import SettingsPage from '@/pages/Settings/SettingsPage'
import UsersPage from '@/pages/Users/UsersPage'
import ShiftsPage from '@/pages/Shifts/ShiftsPage'
import PromotionsPage from '@/pages/Promotions/PromotionsPage'
import NotFoundPage from '@/pages/NotFoundPage'
import PrivateRoute from '@/components/Auth/PrivateRoute'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <PrivateRoute><Layout /></PrivateRoute>,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'pos', element: <POSPage /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'invoices', element: <InvoicesPage /> },
      { path: 'invoices/:id', element: <InvoiceDetailPage /> },
      { path: 'customers', element: <CustomersPage /> },
      { path: 'suppliers', element: <SuppliersPage /> },
      { path: 'purchases', element: <PurchasesPage /> },
      { path: 'returns', element: <ReturnsPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'shifts', element: <ShiftsPage /> },
      { path: 'promotions', element: <PromotionsPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'users', element: <UsersPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export default router
