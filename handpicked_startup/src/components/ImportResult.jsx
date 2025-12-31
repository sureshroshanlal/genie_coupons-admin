// src/modules/imports/components/ImportResult.jsx
import React from "react";

export default function ImportResult({ result }) {
  if (!result) return null;

  const {
    ok,
    inserted,
    updated,
    skipped,
    failed,
    errors,
    dry_run,
    total,
    message,
  } = result;

  const items = [
    ["Inserted", inserted],
    ["Updated", updated],
    ["Skipped", skipped],
    ["Failed", failed],
    ["Total", total],
    ["Dry run", dry_run ? "Yes" : undefined],
  ].filter(([, v]) => v !== undefined);

  return (
    <div
      className={`imp-result ${
        ok === false ? "imp-result--bad" : "imp-result--ok"
      }`}
    >
      {message ? <div className="imp-result__msg">{message}</div> : null}
      {items.length ? (
        <ul className="imp-result__list">
          {items.map(([k, v]) => (
            <li key={k}>
              <span className="imp-result__k">{k}:</span>{" "}
              <span className="imp-result__v">{String(v)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="imp-result__msg">Import completed.</div>
      )}
      {Array.isArray(errors) && errors.length ? (
        <details className="imp-result__errors">
          <summary>View errors ({errors.length})</summary>
          <ul>
            {errors.slice(0, 200).map((e, i) => (
              <li key={i}>
                {typeof e === "string"
                  ? e
                  : `Row ${e.row ?? "?"}: ${e.message ?? JSON.stringify(e)}`}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
