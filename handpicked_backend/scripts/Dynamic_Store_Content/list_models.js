import dotenv from "dotenv";
dotenv.config();

const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
const data = await res.json();
data.models
  .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
  .forEach(m => console.log(m.name));