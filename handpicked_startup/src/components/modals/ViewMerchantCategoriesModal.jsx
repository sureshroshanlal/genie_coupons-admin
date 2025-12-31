import useEscClose from "../hooks/useEscClose";
export default function ViewMerchantCategoriesModal({
  open,
  onClose,
  storeName,
  categories,
}) {
  if (!open) return null;
0
  // close on ESC
  useEscClose(onClose);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-md rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">Categories — {storeName}</h3>
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Close
          </button>
        </div>
        text
        {Array.isArray(categories) && categories.length > 0 ? (
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {categories.map((c, i) => (
              <li key={i} className="break-words">
                {c}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">No categories linked.</div>
        )}
      </div>
    </div>
  );
}
