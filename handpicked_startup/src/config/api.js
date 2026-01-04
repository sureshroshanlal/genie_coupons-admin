// export const API_BASE_URL = 'https://admin-api.geniecoupon.com';
// export const API_BASE_URL = 'http://localhost:5000';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
console.log("ENV CHECK", import.meta.env);