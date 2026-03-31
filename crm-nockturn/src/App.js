import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from './components/Login';
import Students from './pages/Students';
import Users from './pages/Users';
import PublicSiteEditor from './pages/PublicSiteEditor';
import Home from './pages/Home';
import Layout from './components/Layout';

import './App.css';
import api from './api';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  const [token, setToken] = useState(() => {
    return localStorage.getItem('token');
  });

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) return;

      try {
        const res = await api.get('/api/me');
        setCurrentUser(res.data);
      } catch (e) {
        console.error(e);
      }
    };

    fetchUser();
  }, [token]);

  const isTeacher = currentUser?.role === 'teacher';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const handleLogin = (token) => {
    setToken(token);
    localStorage.setItem('token', token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setCurrentUser(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  if (!currentUser) {
    return <div>Загрузка...</div>;
  }

  return (
    <Router>
      <Layout
        onLogout={handleLogout}
        isTeacher={isTeacher}
        isSuperAdmin={isSuperAdmin}
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/students" element={<Students />} />
          <Route path="/users" element={<Users />} />
          <Route path="/editor" element={<PublicSiteEditor />} />
        </Routes>
      </Layout>
    </Router>
  );
}

export default App;