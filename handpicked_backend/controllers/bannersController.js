export const getAllBanners = (req, res) => {
  res.json({ message: "Get all banners" });
};

export const getBannerById = (req, res) => {
  res.json({ message: `Get banner ${req.params.id}` });
};

export const createBanner = (req, res) => {
  res.json({ message: "Banner created" });
};

export const updateBanner = (req, res) => {
  res.json({ message: `Banner ${req.params.id} updated` });
};

export const deleteBanner = (req, res) => {
  res.json({ message: `Banner ${req.params.id} deleted` });
};