import { Outlet, Link } from "react-router-dom";

const Layout = ({ currentUser, onLogout }) => {
  return (
    <div className="App">
      <header className="App-header">
        <Link to="/">
          <h1>Музыкальная студия Ноктюрн</h1>
        </Link>

        <nav className="top-navigation">
          <Link to="/students">Ученики</Link>

          {currentUser?.role !== "teacher" && (
            <Link to="/users">Пользователи</Link>
          )}

          {currentUser?.role === "superadmin" && (
            <Link to="/editor">Редактор сайта</Link>
          )}
        </nav>

        <button onClick={onLogout}>Выйти</button>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;