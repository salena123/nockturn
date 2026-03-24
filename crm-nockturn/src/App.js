import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Students from './pages/Students';
import Users from './pages/Users';

function App() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

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

  return (
    <Router>
      <div className="App">
        <header className="App-header">
          <a href ="/">
            <h1>Музыкальная студия Ноктюрн</h1>
          </a>
          <nav className="navigation">
            <a href="/students">Студенты</a>
            <a href="/users">Пользователи</a>
          </nav>
          <button onClick={handleLogout} className="logout-button">
            Выйти
          </button>
        </header>
        
        <main className="main-content">
          <Routes>
            <Route path="/students" element={<Students />} />
            <Route path="/users" element={<Users />} />
            <Route path="/" element={<Navigate />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
