export function buildStoreJsonLd(store, origin) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: store.name,
    url: `${origin}/stores/${store.slug}`,
    logo: store.logo_url || undefined,
  };
}
export function buildArticleJsonLd(blog, origin) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: blog.title,
    datePublished: blog.created_at,
    dateModified: blog.updated_at,
    author: blog.author?.name
      ? { "@type": "Person", name: blog.author.name }
      : undefined,
    mainEntityOfPage: `${origin}/blog/${blog.slug}`,
    image: blog.hero_image_url || undefined,
  };
}

export function buildOfferJsonLd(coupon, origin) {
  // Build on-site URL for the coupon. If no slug is available, fallback to list.
  const couponUrl = coupon.slug
    ? `${origin}/coupons/${coupon.slug}`
    : `${origin}/coupons`;

  // Seller (Organization) from coupon.merchant
  const sellerName = coupon.merchant?.name || undefined;
  const sellerUrl = coupon.merchant?.slug
    ? `${origin}/stores/${coupon.merchant.slug}`
    : undefined;
  const sellerLogo = coupon.merchant?.logo_url || undefined;

  const seller = sellerName
    ? {
        "@type": "Organization",
        name: sellerName,
        url: sellerUrl,
        logo: sellerLogo,
      }
    : undefined;

  // Optional: wrap the item to give the Offer context
  const itemOffered = coupon.title
    ? {
        "@type": "Product",
        name: coupon.title,
        brand: sellerName ? { "@type": "Brand", name: sellerName } : undefined,
      }
    : undefined;

  const offer = {
    "@context": "https://schema.org",
    "@type": "Offer",
    url: couponUrl,
    // Include validity dates if present
    validFrom: coupon.starts_at || coupon.created_at || undefined,
    priceValidUntil: coupon.ends_at || undefined,
    // Availability is optional; only include if you have a clear rule
    availability: coupon.ends_at ? "https://schema.org/InStock" : undefined,
    // Price fields are optional; include if you have them in the future
    price: coupon.price != null ? String(coupon.price) : undefined,
    priceCurrency: coupon.currency || undefined,
    seller,
    itemOffered,
  };

  // Remove undefineds to keep JSON-LD clean
  Object.keys(offer).forEach((k) => offer[k] === undefined && delete offer[k]);
  if (offer.seller) {
    Object.keys(offer.seller).forEach(
      (k) => offer.seller[k] === undefined && delete offer.seller[k]
    );
  }
  if (offer.itemOffered) {
    Object.keys(offer.itemOffered).forEach(
      (k) => offer.itemOffered[k] === undefined && delete offer.itemOffered[k]
    );
  }

  return offer;
}
