import React from 'react';


const Home = ({ currentUser }) => {
  return (
    <div>
      <h2>Главная</h2>
      <p>Текущий пользователь: {currentUser?.full_name || currentUser?.login}</p>
      <p>Роль: {currentUser?.role}</p>

      <h3>Доступные разделы</h3>
      <ul>
        <li>Ученики</li>
        {currentUser?.role !== 'teacher' && <li>Сотрудники</li>}
        {currentUser?.role !== 'teacher' && <li>Договоры</li>}
        {currentUser?.role !== 'teacher' && <li>Платежи</li>}
        <li>Посещаемость</li>
      </ul>
    </div>
  );
};


export default Home;
