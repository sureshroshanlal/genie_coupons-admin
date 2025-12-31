// src/modules/imports/components/ImportStepCard.jsx
import React, { useMemo, useState } from "react";
import ImportResult from "./ImportResult.jsx";

export default function ImportStepCard({
  step,
  title,
  hint,
  buttonText,
  sampleHref,
  accept = ".xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  disabled = false,
  onUpload, // async (file) => result
}) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const fileName = useMemo(() => file?.name || "", [file]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file || busy || disabled) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await onUpload?.(file);
      setResult(res || { ok: true });
    } catch (err) {
      setError(err?.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const resetSelection = () => {
    setFile(null);
    setError("");
    setResult(null);
  };

  return (
    <div className="imp-card">
      <div className="imp-card__header">
        <div className="imp-card__step">Step - {step}</div>
        <div className="imp-card__title">{title}</div>
        {hint ? <div className="imp-card__hint">({hint})</div> : null}
      </div>

      <form onSubmit={handleSubmit} className="imp-card__body">
        <div className="imp-field__label">Choose a file to import</div>

        <div className="imp-file__row">
          <input
            type="file"
            accept={accept}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={disabled || busy}
            className="imp-file__input"
          />
          {fileName ? (
            <button
              type="button"
              className="imp-btn imp-btn--light"
              onClick={resetSelection}
              disabled={busy}
              title="Clear selection"
            >
              Clear
            </button>
          ) : null}
        </div>

        <div className="imp-file__hint">
          Accepts only .xlsx or .xls formats.
        </div>

        <div className="imp-sample__link">
          <a href={sampleHref} target="_blank" rel="noreferrer">
            Download sample file.
          </a>
        </div>

        <div className="imp-actions">
          <button
            type="submit"
            className="imp-btn imp-btn--primary"
            disabled={!file || busy || disabled}
          >
            {busy ? "Importing..." : buttonText}
          </button>
        </div>

        {error ? <div className="imp-error">{error}</div> : null}
        {result ? <ImportResult result={result} /> : null}
      </form>
    </div>
  );
}
