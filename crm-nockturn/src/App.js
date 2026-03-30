import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link} from 'react-router-dom';
import Login from './components/Login';
import Students from './pages/Students';
import Users from './pages/Users';
import PublicSiteEditor from './pages/PublicSiteEditor';
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
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  if (!currentUser) {
  return <div>Загрузка...</div>;
  }

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <Link to="/">
            <h1>Музыкальная студия Ноктюрн</h1>
          </Link>
          <nav className="top-navigation"> 
            <Link to="/students">Ученики</Link>
            {!isTeacher && <Link to="/users">Пользователи</Link>}
            {isSuperAdmin && <Link to="/editor">Редактор сайта</Link>}
          </nav>
          <button onClick={handleLogout} className="logout-button">
            Выйти
          </button>
        </header>
        
        <main className="main-content">
          <Routes>
            {!token ? (
              <Route path="*" element={<Login onLogin={handleLogin} />} />
            ) : (
              <>
                <Route path="/students" element={<Students />} />
                <Route path="/users" element={<Users />} />
                <Route path="/editor" element={<PublicSiteEditor />} />
                {/* <Route path="/" element={<Navigate to="/" />} /> */}
              </>
            )}
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
