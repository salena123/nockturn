import React from 'react';
import { Link } from 'react-router-dom';

function Layout({ children, onLogout, isTeacher, isSuperAdmin }) {
  return (
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

        <button onClick={onLogout} className="logout-button">
          Выйти
        </button>
      </header>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

export default Layout;