import { useState } from "react";
import Footer from "../components/Footer.jsx";
import "../styles/global.css";

const dummyOffers = Array.from({ length: 20 }).map((_, i) => ({
  title: `🔥 Dummy Offer ${i + 1}`,
  description: "Limited time deal. No code needed.",
  cta: "View Deal",
}));

export default function CategoryPage({ slug, meta }) {
  const [visibleCount, setVisibleCount] = useState(8);

  const categoryName = slug.replace(/-/g, " ");

  return (
    <>
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="/" className="text-xl font-bold text-blue-600">🎯 HandPicked</a>
          <div className="w-full md:w-1/3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search coupons..."
                className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">{meta.title}</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">{meta.description}</p>
        </div>

        {/* Offers */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {dummyOffers.slice(0, visibleCount).map((offer, i) => (
            <div
              key={i}
              className="bg-white border rounded p-5 shadow-sm hover:shadow-md transition"
            >
              <h3 className="font-semibold text-lg mb-2">{offer.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{offer.description}</p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700 transition">
                {offer.cta}
              </button>
            </div>
          ))}
        </div>

        {visibleCount < dummyOffers.length && (
          <div className="text-center mt-8">
            <button
              onClick={() => setVisibleCount((prev) => prev + 6)}
              className="bg-gray-800 text-white px-6 py-2 rounded hover:bg-gray-900 transition"
            >
              Load More Deals
            </button>
          </div>
        )}

        {/* Description 1 */}
        <section className="mt-14 prose max-w-none">
          <h2>Top Tips to Maximize Savings in {categoryName}</h2>
          <p>
            We study thousands of pages across the internet and analyze buying
            behavior across our user base. These strategies help most shoppers
            save 15–30% on average.
          </p>
          <ul>
            <li>Use verified coupons — avoid expired ones from junky sites.</li>
            <li>Combine coupons with seasonal sales like Black Friday & Diwali.</li>
            <li>Enable cashback where available — bonus savings on every order.</li>
          </ul>
        </section>

        {/* Description 2 (SEO + AEO block) */}
        <section className="mt-12 prose max-w-none">
          <h2>Why Trust HandPicked for {categoryName} Offers?</h2>
          <p>
            HandPicked was designed with transparency at its core. Every code is
            either user-tested or manually verified by our team. We update pages
            daily and give priority to high-usage merchants.
          </p>
        </section>

        {/* FAQ Section */}
        <section className="mt-16">
          <h2 className="text-2xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <details key={i} className="bg-gray-50 rounded p-4 border">
                <summary className="cursor-pointer font-medium text-gray-800">
                  Q{i + 1}: What’s the best way to use {categoryName} coupons?
                </summary>
                <div className="text-sm text-gray-600 mt-2">
                  Use the “View Deal” buttons or revealed codes at checkout. Some
                  offers apply automatically while others require pasting.
                </div>
              </details>
            ))}
          </div>
        </section>
      </main>

     <Footer/>
    </>
  );
}