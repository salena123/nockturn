import React from 'react';
import { Link } from 'react-router-dom';


function Layout({ children, currentUser, onLogout }) {
  const isTeacher = currentUser?.role === 'teacher';
  const isSuperAdmin = currentUser?.role === 'superadmin';

  return (
    <div>
      <header>
        <h1>
          <Link to="/">Музыкальная студия Ноктюрн</Link>
        </h1>

        <div>
          <div>Пользователь: {currentUser?.full_name || currentUser?.login}</div>
          <div>Роль: {currentUser?.role}</div>
        </div>

        <nav>
          <Link to="/">Главная</Link>{' | '}
          <Link to="/students">Ученики</Link>{' | '}
          {!isTeacher && (
            <>
              <Link to="/users">Сотрудники</Link>{' | '}
              <Link to="/subscriptions">Заключенные договоры</Link>{' | '}
              <Link to="/payments">Платежи</Link>{' | '}
            </>
          )}
          <Link to="/attendance">Посещаемость</Link>{' | '}
          <Link to="/schedule">Расписание</Link>{' | '}
          {!isTeacher && (
            <>
              <Link to="/tariffs">Тарифы</Link>{' | '}
              <Link to="/discounts">Скидки</Link>{' | '}
            </>
          )}
          {isSuperAdmin && (
            <>
              <Link to="/editor">Редактор сайта</Link>
            </>
          )}
        </nav>

        <button type="button" onClick={onLogout}>
          Выйти
        </button>
      </header>

      <hr />

      <main>{children}</main>
    </div>
  );
}


export default Layout;
