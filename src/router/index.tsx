import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import { MainLayout } from '../layouts/MainLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Components
import { ProtectedRoute } from '../components/common/ProtectedRoute';

// Pages
import { Home } from '../pages/Home';
import { Auctions } from '../pages/Auctions';
import { Login } from '../pages/Login';
import { Register } from '../pages/Register';
import { ForgotPassword } from '../pages/ForgotPassword';
import { ResetPassword } from '../pages/ResetPassword';
import { Dashboard } from '../pages/Dashboard';
import { Admin } from '../pages/Admin';
import { Contact } from '../pages/Contact';
import { About } from '../pages/About';
import { NotFound } from '../pages/NotFound';

import { FAQ } from '../pages/FAQ';
import { Notices } from '../pages/Notices';
import { News } from '../pages/News';
import { AuctionDetail } from '../pages/AuctionDetail';

import { SellerDashboard } from '../pages/seller/SellerDashboard';
import { ManageAuctions } from '../pages/seller/ManageAuctions';
import { AuctionForm } from '../pages/seller/AuctionForm';

import { MyBids } from '../pages/dashboard/MyBids';
import { Interested } from '../pages/dashboard/Interested';
import { Notifications } from '../pages/dashboard/Notifications';
import { ProfileSettings } from '../pages/dashboard/ProfileSettings';
import { DocumentVault } from '../pages/dashboard/DocumentVault';
import { Vendors } from '../pages/dashboard/Vendors';
import { Reminders } from '../pages/dashboard/Reminders';
import { Inventory } from '../pages/dashboard/Inventory';
import { QuotePage } from '../pages/dashboard/QuotePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'auctions', element: <Auctions /> },
      { path: 'auctions/:id', element: <AuctionDetail /> },
      { path: 'contact', element: <Contact /> },
      { path: 'about', element: <About /> },
      { path: 'faq', element: <FAQ /> },
      { path: 'notices', element: <Notices /> },
      { path: 'news', element: <News /> },
      { path: 'quotes', element: <Navigate to="/dashboard/quotes" replace /> },
      { path: 'quote', element: <Navigate to="/dashboard/quotes" replace /> },
    ],
  },
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password', element: <ResetPassword /> },
      { index: true, element: <Navigate to="/auth/login" replace /> },
    ],
  },
  {
    path: '/dashboard',
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Dashboard /> },
      { path: 'bids', element: <MyBids /> },
      { path: 'interested', element: <Interested /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'documents', element: <DocumentVault /> },
      { path: 'profile', element: <ProfileSettings /> },
      { path: 'vendors', element: <Vendors /> },
      { path: 'reminders', element: <Reminders /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'quotes', element: <QuotePage /> },
      { path: 'quote', element: <Navigate to="/dashboard/quotes" replace /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Admin /> },
    ],
  },
  {
    path: '/seller',
    element: (
      <ProtectedRoute allowedRoles={['seller', 'admin', 'superadmin']}>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <SellerDashboard /> },
      { path: 'auctions', element: <ManageAuctions /> },
      { path: 'auctions/create', element: <AuctionForm /> },
      { path: 'auctions/:id/edit', element: <AuctionForm /> },
    ],
  },
]);
