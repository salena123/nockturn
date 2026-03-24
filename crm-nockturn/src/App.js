import React, { useState, useEffect } from 'react';
import Login from './components/Login';

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
    console.log("TOKEN:", token);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Музыкальная студия Ноктюрн</h1>
        <button onClick={handleLogout} className="logout-button">
          Выйти
        </button>
      </header>
    </div>
  );
}

export default App;
