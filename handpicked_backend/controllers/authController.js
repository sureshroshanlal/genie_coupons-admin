import jwt from "jsonwebtoken";
import { supabase } from "../dbhelper/dbclient.js";
import bcrypt from "bcrypt";
import { config } from "../config/config.js";

export async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }
console.log('Login request:', req.body);
  try {
    // Fetch user by user_id
    const { data, error } = await supabase
      .from("users")
      .select("id, email, password_hash, role_id")
      .eq("email", email)
      .single();

    console.log('Supabase response:', data, error);

    if (error) throw error;

    if (!data) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if password hash exists
    if (!data.password_hash) {
      return res.status(500).json({ message: "Password not set for user" });
    }
    // Compare password with hash
    const isMatch = await bcrypt.compare(password, data.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: data.id,
        email: data.email,
        role_id: data.role_id, // 🔹 Important
      },
      config.jwtSecret,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        id: data.id,
        email: data.email,
        role_id: data.role_id,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

export const profile = (req, res) => {
  res.json({ message: "Protected profile route", user: req.user });
};
