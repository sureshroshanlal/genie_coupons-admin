// src/modules/imports/StoresImportsPage.jsx
import React from "react";
import ImportStepCard from "./ImportStepCard.jsx";
import {
  importStores,
  importTagStoreRelations,
  importStoreCouponsDeals,
  importFirstParagraph,
  importSeoDescCheck,
  importStoreSlugsDefaultContent,
} from "../services/importsService";

export default function StoresImportsPage() {
  const onStep1 = (file) => importStores(file ); //{ dryRun: true }
  const onStep2 = (file) => importTagStoreRelations(file);
  const onStep3 = (file) => importStoreCouponsDeals(file);
  const onStep4 = (file) => importFirstParagraph(file);
  const onStep5 = (file) => importSeoDescCheck(file);
  const onStep6 = (file) => importStoreSlugsDefaultContent(file);

  return (
    <div className="imp-page">
      <div className="imp-page__header">
        <h1>Stores Imports</h1>
        <button className="imp-btn imp-btn--light">Back</button>
      </div>

      <div className="imp-warning">
        <div className="imp-warning__title">
          Be Careful! Action can’t be roll back after importing.
        </div>
        <div className="imp-warning__text">
          Please cross check Excel file format, columns, data & ids before
          importing.
        </div>
      </div>

      <ImportStepCard
        step={1}
        title="Import Stores"
        hint="Stores with default content"
        buttonText="Import Stores"
        sampleHref="/samples/1-Import-Stores-Sample-File.xlsx"
        onUpload={onStep1}
      />

      <ImportStepCard
        step={2}
        title="Import Tags Stores Relation"
        buttonText="Import Tag Stores Relation"
        sampleHref="/samples/2-Import-Tag-Stores-Relation.xlsx"
        onUpload={onStep2}
      />

      <ImportStepCard
        step={3}
        title="Import Stores Coupons/Deals"
        buttonText="Import Stores Coupons/Deals"
        sampleHref="/samples/3-Import-Store-Coupons-Deals.xlsx"
        onUpload={onStep3}
      />

      <ImportStepCard
        step={4}
        title="Import first paragraph (for Stores)"
        buttonText="Import first paragraph"
        sampleHref="/samples/4-Import-First-Paragraph.xlsx"
        onUpload={onStep4}
      />

      <ImportStepCard
        step={5}
        title="Import Stores Seo Desc Check"
        buttonText="Import Stores Seo Desc Check"
        sampleHref="/samples/5-Import-Stores-SEO-Desc-Check.xlsx"
        onUpload={onStep5}
      />

      <ImportStepCard
        step={6}
        title="Import Stores Slugs for Default Content"
        buttonText="Import Stores Slugs for Default Content"
        sampleHref="/samples/6-Import-Stores-Slugs-Default-Content.xlsx"
        onUpload={onStep6}
      />
    </div>
  );
}