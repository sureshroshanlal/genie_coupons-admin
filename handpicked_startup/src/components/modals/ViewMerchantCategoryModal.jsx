// src/components/merchantCategories/ViewMerchantCategoryModal.jsx
import React, { useEffect, useState } from "react";
import { getMerchantCategory } from "../../services/merchantCategoryService";
import useEscClose from "../hooks/useEscClose";

export default function ViewMerchantCategoryModal({ categoryId, onClose }) {
  const [cat, setCat] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await getMerchantCategory(categoryId);
        if (!mounted) return;
        setCat(data || {});
      } catch (e) {
        console.error("Load category failed:", e?.message || e);
        if (mounted) setCat({});
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [categoryId]);

  const Field = ({ label, value }) => (
    <div className="grid grid-cols-3 gap-4 items-start">
      <div className="text-gray-600">{label}</div>
      <div className="col-span-2">{value ?? "—"}</div>
    </div>
  );

  const boolText = (v) => (v ? "Yes" : "No");


  // close on ESC
  useEscClose(onClose);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 text-white">
        Loading…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white w-full max-w-5xl rounded shadow-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Category Details</h2>
          <button className="border px-3 py-1 rounded" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="space-y-3">
          <Field label="ID" value={cat?.id} />
          <Field label="Name" value={cat?.name} />
          <Field label="Slug" value={cat?.slug} />
          <Field label="Parent ID" value={cat?.parent_id ?? "—"} />
          <Field label="Publish" value={boolText(cat?.is_publish)} />
          <Field label="Show Home" value={boolText(cat?.show_home)} />
          <Field
            label="Show Deals Page"
            value={boolText(cat?.show_deals_page)}
          />
          <Field label="Is Header" value={boolText(cat?.is_header)} />
          <Field
            label="Created"
            value={
              cat?.created_at ? new Date(cat.created_at).toLocaleString() : "—"
            }
          />

          <div className="grid grid-cols-3 gap-6 mt-4">
            <div>
              <div className="text-gray-600 mb-1">Thumbnail</div>
              {cat?.thumb_url ? (
                <img
                  src={cat.thumb_url}
                  alt="Thumbnail"
                  className="w-32 h-32 object-cover border rounded"
                />
              ) : (
                <div className="w-32 h-32 border rounded flex items-center justify-center text-xs text-gray-500">
                  —
                </div>
              )}
            </div>

            <div>
              <div className="text-gray-600 mb-1">Top Banner</div>
              {cat?.top_banner_url ? (
                <>
                  <img
                    src={cat.top_banner_url}
                    alt="Top banner"
                    className="w-48 h-24 object-cover border rounded"
                  />
                  <div className="text-xs text-gray-600 mt-1 break-all">
                    {cat.top_banner_link_url || "—"}
                  </div>
                </>
              ) : (
                <div className="w-48 h-24 border rounded flex items-center justify-center text-xs text-gray-500">
                  —
                </div>
              )}
            </div>

            <div>
              <div className="text-gray-600 mb-1">Side Banner</div>
              {cat?.side_banner_url ? (
                <>
                  <img
                    src={cat.side_banner_url}
                    alt="Side banner"
                    className="w-40 h-40 object-cover border rounded"
                  />
                  <div className="text-xs text-gray-600 mt-1 break-all">
                    {cat.side_banner_link_url || "—"}
                  </div>
                </>
              ) : (
                <div className="w-40 h-40 border rounded flex items-center justify-center text-xs text-gray-500">
                  —
                </div>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-gray-600 mb-1">Description</div>
            <div className="border rounded p-3 whitespace-pre-wrap">
              {cat?.description || "—"}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div>
              <div className="text-gray-600 mb-1">Meta Title</div>
              <div className="border rounded p-2">{cat?.meta_title || "—"}</div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Meta Keywords</div>
              <div className="border rounded p-2">
                {cat?.meta_keywords || "—"}
              </div>
            </div>
            <div>
              <div className="text-gray-600 mb-1">Meta Description</div>
              <div className="border rounded p-2">
                {cat?.meta_description || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
