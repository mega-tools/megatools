import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Layout from "./Layout";
import LoginPage from "./LoginPage";
import LiveInboxPage from "./LiveInboxPage";
import ExternalUrlPage from "./ExternalUrlPage";
import PersonalUrlPage from "./PersonalUrlPage";
import UserManagementPage from "./UserManagementPage";
import EmbeddedPage from "./EmbeddedPage";
import SettingsPage from "./SettingsPage";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ 
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
      minHeight: "100vh", background: "#0d1117", gap: 16
    }}>
      <img src="/logo.webp" alt="Mega Tools" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
      <div style={{ color: "#58a6ff", fontSize: 16, fontWeight: 600 }}>Loading...</div>
    </div>
  );
  return user ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }) => {
  const { user } = useAuth();
  return user?.role === "admin" ? children : <Navigate to="/live-inbox" />;
};

const ModeratorRoute = ({ children }) => {
  const { user } = useAuth();
  return (user?.role === "admin" || user?.role === "moderator") ? children : <Navigate to="/live-inbox" />;
};

const NotFoundPage = () => (
  <div style={{ textAlign: "center", padding: 80, color: "#8b949e" }}>
    <h1 style={{ fontSize: 60, color: "#58a6ff", marginBottom: 10 }}>404</h1>
    <p style={{ fontSize: 16, marginBottom: 20 }}>Page not found</p>
    <a href="/" style={{ color: "#58a6ff", textDecoration: "none", fontSize: 14 }}>Back to Dashboard</a>
  </div>
);

export default function App() {
  return (
    <Routes>
      <Route path="/login/:username" element={<LoginPage />} />
      <Route path="/login" element={<LoginPage />} />
      
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<LiveInboxPage />} />
        <Route path="live-inbox" element={<LiveInboxPage />} />
        <Route path="links" element={<ExternalUrlPage />} />
        <Route path="personal-links" element={<PersonalUrlPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="users" element={<ModeratorRoute><UserManagementPage /></ModeratorRoute>} />
        <Route path="embedded" element={<AdminRoute><EmbeddedPage /></AdminRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}