import "@/App.css";
import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Loader } from "@/components/States";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";

import CustomerLayout from "@/pages/customer/CustomerLayout";
import CustomerHome from "@/pages/customer/CustomerHome";
import Booking from "@/pages/customer/Booking";
import MyTasks from "@/pages/customer/MyTasks";
import CustomerTaskDetail from "@/pages/customer/CustomerTaskDetail";
import CustomerChatList from "@/pages/customer/CustomerChatList";
import CustomerProfile from "@/pages/customer/CustomerProfile";

import PALayout from "@/pages/pa/PALayout";
import PATasks from "@/pages/pa/PATasks";
import PATaskDetail from "@/pages/pa/PATaskDetail";
import PAEarnings from "@/pages/pa/PAEarnings";
import PAProfile from "@/pages/pa/PAProfile";

import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminTasks from "@/pages/admin/AdminTasks";
import AdminPAs from "@/pages/admin/AdminPAs";
import AdminCustomers from "@/pages/admin/AdminCustomers";
import AdminPricing from "@/pages/admin/AdminPricing";
import AdminPayments from "@/pages/admin/AdminPayments";
import AdminContent from "@/pages/admin/AdminContent";

function homeFor(role) {
  return role === "admin" ? "/admin" : role === "pa" ? "/pa" : "/app";
}

function Protected({ role, children }) {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen bg-slate-50"><Loader /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={homeFor(user.role)} replace />;
  return children;
}

function RootRoute() {
  const { user } = useAuth();
  if (user === null) return <div className="min-h-screen bg-slate-50"><Loader /></div>;
  if (user) return <Navigate to={homeFor(user.role)} replace />;
  return <Landing />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<Login />} />

      {/* Customer */}
      <Route path="/app" element={<Protected role="customer"><CustomerLayout /></Protected>}>
        <Route index element={<CustomerHome />} />
        <Route path="tasks" element={<MyTasks />} />
        <Route path="tasks/:id" element={<CustomerTaskDetail />} />
        <Route path="chat" element={<CustomerChatList />} />
        <Route path="profile" element={<CustomerProfile />} />
      </Route>
      <Route path="/app/book" element={<Protected role="customer"><Booking /></Protected>} />

      {/* PA */}
      <Route path="/pa" element={<Protected role="pa"><PALayout /></Protected>}>
        <Route index element={<PATasks />} />
        <Route path="earnings" element={<PAEarnings />} />
        <Route path="profile" element={<PAProfile />} />
      </Route>
      <Route path="/pa/tasks/:id" element={<Protected role="pa"><PATaskDetail /></Protected>} />

      {/* Admin */}
      <Route path="/admin" element={<Protected role="admin"><AdminLayout /></Protected>}>
        <Route index element={<AdminDashboard />} />
        <Route path="tasks" element={<AdminTasks />} />
        <Route path="pas" element={<AdminPAs />} />
        <Route path="customers" element={<AdminCustomers />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="content" element={<AdminContent />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster position="top-center" richColors />
      </BrowserRouter>
    </AuthProvider>
  );
}
