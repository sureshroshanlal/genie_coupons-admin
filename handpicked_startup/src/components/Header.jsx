import { FiMenu, FiLogOut } from "react-icons/fi";
import {useState, useEffect} from "react";

export default function Header({
  onToggleSidebar,
  isSidebarCollapsed,
}) {
  const handleLogout = () => {
    localStorage.removeItem("authToken"); // Clear stored login
    window.location.href = "/"; // Redirect to login page
  };
  const [username, setUsername] = useState("");
  useEffect(() => {
    const storedUsername = localStorage.getItem("username");
    if (storedUsername) {
      setUsername(storedUsername);
    }
  }, []);

  return (
    <header
      className="flex items-center justify-between px-4 py-2 bg-white shadow-md"
      role="banner"
    >
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="p-2 rounded-md hover:bg-gray-200 transition"
        >
          <FiMenu className="text-xl" /*size={20}*/ />
        </button>

        {/* Brand / Logo */}
        <h1 className="text-lg font-bold text-gray-800">
          Admin Dashboard
        </h1>
      </div>

      {/* Right Section */}
      <div className="flex items-center space-x-3">
        {/* Dark Mode Toggle */}
        {/* Logout button */}
        <button
          onClick={handleLogout}
          aria-label="Logout"
          className="p-2 rounded-md hover:bg-red-200 transition"
        >
          <FiLogOut className="text-xl text-red-500"/>
        </button>

        {/* Username / Profile */}
        <span className="text-gray-800 font-medium">
          welcome {username}
        </span>
      </div>
    </header>
  );
}