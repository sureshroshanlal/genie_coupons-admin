import { useState, useEffect } from "react";
import * as FiIcons from "react-icons/fi";
import { Link, useLocation } from "react-router-dom";

export default function SidebarMenu({ isCollapsed }) {
  const [menuItems, setMenuItems] = useState([]);
  const [openIndex, setOpenIndex] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const storedMenus = localStorage.getItem("sidebarMenus");
    if (storedMenus) {
      try {
        setMenuItems(JSON.parse(storedMenus));
      } catch (err) {
        console.error("Failed to parse sidebarMenus:", err);
      }
    }
  }, []);

  const toggleIndex = (index) => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  const getIcon = (iconName) => {
    if (!iconName) return null;
    const IconComponent = FiIcons[iconName];
    return IconComponent ? <IconComponent /> : null;
  };

  const cleanPath = (path) => {
    if (!path) return "";
    return path.startsWith("/") ? path.slice(1) : path;
  };

  const isActive = (path) => {
    // Compare with /dashboard/cleanPath value
    return location.pathname === `/dashboard/${cleanPath(path)}`;
  };

  return (
    <nav aria-label="Admin Sidebar Menu" className="px-2">
      <ul role="list" className="space-y-1">
        {menuItems.map((item, index) => {
          const hasChildren = item.children && item.children.length > 0;

          if (hasChildren) {
            return (
              <li key={item.id || item.title}>
                <button
                  onClick={() => toggleIndex(index)}
                  aria-expanded={openIndex === index}
                  aria-controls={`submenu-${index}`}
                  className={`flex items-center w-full p-2 rounded-md
                    ${isActive(item.path)
                      ? "bg-indigo-200 text-indigo-900"
                      : "text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}
                  `}
                >
                  <span className="text-lg">{getIcon(item.icon)}</span>
                  {!isCollapsed && (
                    <span className="ml-3 font-medium">{item.title}</span>
                  )}
                </button>

                {openIndex === index && !isCollapsed && (
                  <ul
                    id={`submenu-${index}`}
                    role="group"
                    className="pl-8 mt-1 space-y-1"
                  >
                    {item.children.map((subItem) => (
                      <li key={subItem.id || subItem.title}>
                        <Link
                          to={cleanPath(subItem.path)}
                          className={`flex items-center w-full p-2 text-sm rounded-md
                            ${isActive(subItem.path)
                              ? "bg-indigo-300 text-indigo-900"
                              : "text-gray-600 dark:text-gray-300 hover:bg-gray-100"}
                          `}
                        >
                          <span className="text-base">
                            {getIcon(subItem.icon)}
                          </span>
                          <span className="ml-2">{subItem.title}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          }

          return (
            <li key={item.id || item.title}>
              <Link
                to={cleanPath(item.path)}
                className={`flex items-center w-full p-2 rounded-md
                  ${isActive(item.path)
                    ? "bg-indigo-200 text-indigo-900"
                    : "text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"}
                `}
              >
                <span className="text-lg">{getIcon(item.icon)}</span>
                {!isCollapsed && (
                  <span className="ml-3 font-medium">{item.title}</span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}