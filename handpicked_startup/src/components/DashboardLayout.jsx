import { useState } from "react";
import { Outlet } from "react-router-dom";
import "../styles/global.css";

import Header from "../components/Header.jsx";
import Sidebar from "../components/Sidebar.jsx";
import Footer from "../components/Footer.jsx";

export default function DashboardLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => !prev);
    document.body.classList.toggle("sidebar-collapsed", !isSidebarCollapsed);
  };

  return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header
          onToggleSidebar={toggleSidebar}
          isSidebarCollapsed={isSidebarCollapsed}
        />

        <div className="flex flex-1">
          <Sidebar isSidebarCollapsed={isSidebarCollapsed} />

          <main
            id="main-content"
            role="main"
            tabIndex="-1"
            className="flex-1 p-4 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
          {/* All sidebar pages render here */}
          <Outlet />
          </main>
        </div>

        <Footer version="v1.0.0" />
      </div>
  );
}