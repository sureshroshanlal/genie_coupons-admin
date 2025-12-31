// src/components/UserInfo.jsx
import { useEffect, useState } from 'react';

export default function UserInfo() {
  const [username, setUsername] = useState('Admin');

  useEffect(() => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    if (auth.username) {
      setUsername(auth.username);
    }

    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('auth');
        window.location.href = '/login';
      });
    }
  }, []);

  return (
    <>
      <span className="username" aria-label="Logged in as">{username}</span>
      <button type="button" id="logout-button" aria-label="Logout">Logout</button>
    </>
  );
}