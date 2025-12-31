import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const [isClient, setIsClient] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsClient(true);
    setIsAuthenticated(Boolean(localStorage.getItem("authToken")));
  }, []);

  if (!isClient) {
    // Avoid SSR/hydration issues
    return null;
  }

  if (!isAuthenticated) {
    // Redirect unauthenticated users to /login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}