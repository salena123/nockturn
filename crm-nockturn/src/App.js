import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link} from 'react-router-dom';
import Login from './components/Login';
import Students from './pages/Students';
import Users from './pages/Users';
import PublicSiteEditor from './pages/PublicSiteEditor';

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
          <Link to="/">
            <h1>Музыкальная студия Ноктюрн</h1>
          </Link>
          <nav>
            <Link to="/students">Ученики</Link>
            <Link to="/users">Пользователи</Link>
            <Link to="/editor">Редактор сайта</Link>
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
