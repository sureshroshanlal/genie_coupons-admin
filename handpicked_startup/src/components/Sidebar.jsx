import SidebarMenu from "./SidebarMenu.jsx";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

export default function Sidebar({ isSidebarCollapsed, onToggleSidebar }) {
  return (
    <aside
      className={`transition-all duration-300 ${
        isSidebarCollapsed ? "w-16" : "w-64"
      } bg-white dark:bg-gray-900 border-r border-gray-200 ease-in-out flex flex-col`}
      aria-label="Sidebar Navigation"
    >
      {/* Collapse Button */}
      <div className="flex justify-end p-2">
        <button
          onClick={onToggleSidebar}
          aria-label={isSidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          className="p-1 rounded-md hover:bg-gray-200"
        >
          {isSidebarCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>
      </div>

      {/* Sidebar Menu */}
      <div className="flex-1 overflow-y-auto">
        <SidebarMenu isCollapsed={isSidebarCollapsed} />
      </div>

      {/* Footer (Optional) */}
      <div className="p-2 text-xs text-gray-500 dark:text-gray-400">
        v1.0.0
      </div>
    </aside>
  );
}