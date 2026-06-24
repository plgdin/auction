import { createBrowserRouter, Navigate } from 'react-router-dom';

// Layouts
import { MainLayout } from '../layouts/MainLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { AuthLayout } from '../layouts/AuthLayout';

// Components
import { ProtectedRoute } from '../components/common/ProtectedRoute';

import { lazy, Suspense } from 'react';

// Custom lazy-loader wrapper with Suspense fallback
const lazyWithSuspense = (importFn: () => Promise<{ default: React.ComponentType<any> }>) => {
  const LazyComponent = lazy(importFn);
  return (props: any) => (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
        <p className="text-xs text-slate-450 mt-4 font-semibold tracking-wider uppercase">Loading Lelam Page...</p>
      </div>
    }>
      <LazyComponent {...props} />
    </Suspense>
  );
};

import { Home } from '../pages/Home';

// Lazy-loaded Pages
const Auctions = lazyWithSuspense(() => import('../pages/Auctions').then(m => ({ default: m.Auctions })));
const Login = lazyWithSuspense(() => import('../pages/Login').then(m => ({ default: m.Login })));
const Register = lazyWithSuspense(() => import('../pages/Register').then(m => ({ default: m.Register })));
const ForgotPassword = lazyWithSuspense(() => import('../pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const ResetPassword = lazyWithSuspense(() => import('../pages/ResetPassword').then(m => ({ default: m.ResetPassword })));
const Dashboard = lazyWithSuspense(() => import('../pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Admin = lazyWithSuspense(() => import('../pages/Admin').then(m => ({ default: m.Admin })));
const Contact = lazyWithSuspense(() => import('../pages/Contact').then(m => ({ default: m.Contact })));
const About = lazyWithSuspense(() => import('../pages/About').then(m => ({ default: m.About })));
const NotFound = lazyWithSuspense(() => import('../pages/NotFound').then(m => ({ default: m.NotFound })));

const FAQ = lazyWithSuspense(() => import('../pages/FAQ').then(m => ({ default: m.FAQ })));
const Notices = lazyWithSuspense(() => import('../pages/Notices').then(m => ({ default: m.Notices })));
const News = lazyWithSuspense(() => import('../pages/News').then(m => ({ default: m.News })));
const AuctionDetail = lazyWithSuspense(() => import('../pages/AuctionDetail').then(m => ({ default: m.AuctionDetail })));
const Privacy = lazyWithSuspense(() => import('../pages/Privacy').then(m => ({ default: m.Privacy })));
const Terms = lazyWithSuspense(() => import('../pages/Terms').then(m => ({ default: m.Terms })));
const Cookies = lazyWithSuspense(() => import('../pages/Cookies').then(m => ({ default: m.Cookies })));

const SellerDashboard = lazyWithSuspense(() => import('../pages/seller/SellerDashboard').then(m => ({ default: m.SellerDashboard })));
const ManageAuctions = lazyWithSuspense(() => import('../pages/seller/ManageAuctions').then(m => ({ default: m.ManageAuctions })));
const AuctionForm = lazyWithSuspense(() => import('../pages/seller/AuctionForm').then(m => ({ default: m.AuctionForm })));

const MyBids = lazyWithSuspense(() => import('../pages/dashboard/MyBids').then(m => ({ default: m.MyBids })));
const Interested = lazyWithSuspense(() => import('../pages/dashboard/Interested').then(m => ({ default: m.Interested })));
const Notifications = lazyWithSuspense(() => import('../pages/dashboard/Notifications').then(m => ({ default: m.Notifications })));
const ProfileSettings = lazyWithSuspense(() => import('../pages/dashboard/ProfileSettings').then(m => ({ default: m.ProfileSettings })));
const DocumentVault = lazyWithSuspense(() => import('../pages/dashboard/DocumentVault').then(m => ({ default: m.DocumentVault })));
const Vendors = lazyWithSuspense(() => import('../pages/dashboard/Vendors').then(m => ({ default: m.Vendors })));
const Reminders = lazyWithSuspense(() => import('../pages/dashboard/Reminders').then(m => ({ default: m.Reminders })));
const Inventory = lazyWithSuspense(() => import('../pages/dashboard/Inventory').then(m => ({ default: m.Inventory })));
const QuotePage = lazyWithSuspense(() => import('../pages/dashboard/QuotePage').then(m => ({ default: m.QuotePage })));

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
      { path: 'privacy', element: <Privacy /> },
      { path: 'terms', element: <Terms /> },
      { path: 'cookies', element: <Cookies /> },
      { path: 'quotes', element: <QuotePage /> },
      { path: 'quote', element: <Navigate to="/quotes" replace /> },
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
