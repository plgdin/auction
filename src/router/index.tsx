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
import { Tenders } from '../pages/Tenders';
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
import { TenderDetail } from '../pages/TenderDetail';

import { SellerDashboard } from '../pages/seller/SellerDashboard';
import { ManageAuctions } from '../pages/seller/ManageAuctions';
import { AuctionForm } from '../pages/seller/AuctionForm';

import { MyBids } from '../pages/dashboard/MyBids';
import { MyTenders } from '../pages/dashboard/MyTenders';
import { Watchlist } from '../pages/dashboard/Watchlist';
import { Wallet } from '../pages/dashboard/Wallet';
import { Notifications } from '../pages/dashboard/Notifications';
import { ProfileSettings } from '../pages/dashboard/ProfileSettings';
import { DocumentVault } from '../pages/dashboard/DocumentVault';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    errorElement: <NotFound />,
    children: [
      { index: true, element: <Home /> },
      { path: 'auctions', element: <Auctions /> },
      { path: 'auctions/:id', element: <AuctionDetail /> },
      { path: 'tenders', element: <Tenders /> },
      { path: 'tenders/:id', element: <TenderDetail /> },
      { path: 'contact', element: <Contact /> },
      { path: 'about', element: <About /> },
      { path: 'faq', element: <FAQ /> },
      { path: 'notices', element: <Notices /> },
      { path: 'news', element: <News /> },
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
      { path: 'tenders', element: <MyTenders /> },
      { path: 'watchlist', element: <Watchlist /> },
      { path: 'wallet', element: <Wallet /> },
      { path: 'notifications', element: <Notifications /> },
      { path: 'documents', element: <DocumentVault /> },
      { path: 'profile', element: <ProfileSettings /> },
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
