import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PayDeposit from "./pages/PayDeposit";
import Privacy from "./pages/Privacy";
import Footer from "./components/Footer";
import { getUser } from "./lib/api";
import { useTheme } from "./contexts/ThemeContext";

function Protected({ children, adminOnly = false }) {
  const user = getUser();
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicOnly({ children }) {
  const user = getUser();
  if (user) return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  return children;
}

export default function App() {
  const { resolvedTheme } = useTheme();
  return (
    <div className="App flex flex-col min-h-screen">
      <BrowserRouter>
        <Routes>
          <Route
            path="/"
            element={
              <PublicOnly>
                <Landing />
              </PublicOnly>
            }
          />
          <Route path="/privacy" element={<Privacy />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <Register />
              </PublicOnly>
            }
          />
          <Route
            path="/forgot-password"
            element={
              <PublicOnly>
                <ForgotPassword />
              </PublicOnly>
            }
          />
          <Route
            path="/pay-deposit"
            element={
              <Protected>
                <PayDeposit />
              </Protected>
            }
          />
          <Route
            path="/dashboard"
            element={
              <Protected>
                <Dashboard />
              </Protected>
            }
          />
          <Route
            path="/admin"
            element={
              <Protected adminOnly>
                <AdminDashboard />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Footer />
      </BrowserRouter>
      <Toaster
        position="top-right"
        theme={resolvedTheme}
        toastOptions={{
          style: {
            background: "var(--surface)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          },
        }}
      />
    </div>
  );
}
