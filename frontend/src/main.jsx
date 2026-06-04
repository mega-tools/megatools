import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./AuthContext";
import "./index.css";

// ⭐ ERROR BOUNDARY — Catch rendering errors
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 App Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          background: "#0d1117",
          color: "#c9d1d9",
          fontFamily: "'Segoe UI', Arial, sans-serif",
          textAlign: "center",
          padding: 20
        }}>
          <div>
            <h1 style={{ fontSize: 48, color: "#f85149", marginBottom: 10 }}>⚠️</h1>
            <h2 style={{ color: "#e6edf3", marginBottom: 10 }}>Something went wrong</h2>
            <p style={{ color: "#8b949e", marginBottom: 20, fontSize: 13 }}>
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
              style={{
                padding: "10px 24px",
                background: "#238636",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600
              }}
            >
              🔄 Reload Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ⭐ RENDER APP
const rootElement = document.getElementById("root");

if (!rootElement) {
  console.error('❌ Root element not found! Check index.html');
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}