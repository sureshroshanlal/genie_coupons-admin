import React, { useEffect, useState } from "react";
import { getAuthor } from "../../services/authorService";
import useEscClose from "../hooks/useEscClose";

export default function ViewAuthorModal({ authorId, onClose }) {
  const [a, setA] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await getAuthor(authorId);
      if (mounted) setA(data);
    })();
    return () => {
      mounted = false;
    };
  }, [authorId]);

    // close on ESC
  useEscClose(onClose);

  if (!a) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading author...
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-lg rounded shadow-lg p-6">
        <h2 className="text-lg font-semibold mb-4">{a.name}</h2>
        <div className="space-y-2">
          <p>
            <strong>Email:</strong> {a.email || "—"}
          </p>
          <p>
            <strong>Active:</strong> {a.is_active ? "Yes" : "No"}
          </p>
          <p>
            <strong>Created:</strong>{" "}
            {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}
          </p>
          <p>
            <strong>Updated:</strong>{" "}
            {a.updated_at ? new Date(a.updated_at).toLocaleString() : "—"}
          </p>
        </div>
        <div className="flex justify-end mt-6">
          <button onClick={onClose} className="border px-4 py-2 rounded">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
