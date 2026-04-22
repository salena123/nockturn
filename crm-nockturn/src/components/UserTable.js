import React from 'react';


const UserTable = ({ users, onEdit, onDelete, onToggleBlock }) => {
  if (!users.length) {
    return <div>Сотрудники не найдены.</div>;
  }

  return (
    <table border="1" cellPadding="6" cellSpacing="0">
      <thead>
        <tr>
          <th>ID</th>
          <th>Логин</th>
          <th>ФИО</th>
          <th>Телефон</th>
          <th>Роль</th>
          <th>Активен</th>
          <th>Дата начала работы</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id}>
            <td>{user.id}</td>
            <td>{user.login}</td>
            <td>{user.full_name || ''}</td>
            <td>{user.phone || ''}</td>
            <td>{user.role || ''}</td>
            <td>{user.is_active ? 'Да' : 'Нет'}</td>
            <td>{user.hire_date || ''}</td>
            <td>
              <button type="button" onClick={() => onEdit(user)}>
                Редактировать
              </button>{' '}
              <button type="button" onClick={() => onToggleBlock(user)}>
                {user.is_active ? 'Заблокировать' : 'Разблокировать'}
              </button>{' '}
              <button type="button" onClick={() => onDelete(user)}>
                Удалить
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};


export default UserTable;
