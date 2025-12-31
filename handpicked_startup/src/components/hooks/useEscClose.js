import { useEffect } from "react";

/**
 * Custom hook to close something when Escape is pressed.
 * @param {Function} onClose - function to call on Escape
 */
export default function useEscClose(onClose) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleEsc);

    return () => window.removeEventListener("keydown", handleEsc);
  }, [onClose]);
}
