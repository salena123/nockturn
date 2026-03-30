import React from 'react';

const UserTable = ({ users, currentUser, onEdit, onDelete }) => {
  const getHeaders = () => {
    if (users.length === 0) return [];
    
    const fieldTranslations = {
      id: 'ID',
      email: 'Email',
      role: 'Роль'
    };
    
    return Object.keys(users[0]).map(key => ({
      key,
      label: fieldTranslations[key] || key
    }));
  };

  const canEditUser = (user) => {
    if (!currentUser) return false;
    
    if (currentUser.role === 'superadmin') return true;
    
    if (user.id === currentUser.id) return true;
    
    if (user.role === 'teacher' && currentUser.role === 'admin') {
      return true;
    }
    
    return false;
  };

  const canDeleteUser = (user) => {
    if (!currentUser) return false;
    
    if (user.id === currentUser.id) return false;
    
    if (currentUser.role === 'superadmin') return true;
    
    if ((user.role === 'superadmin' || user.role === 'admin') && currentUser.role === 'admin') {
      return false;
    }
    
    return true;
  };

  const headers = getHeaders();

  return (
    <table border="1" cellPadding="8" cellSpacing="0">
      <thead>
        <tr>
          {headers.map(header => (
            <th key={header.key}>{header.label}</th>
          ))}
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => (
          <tr key={user.id}>
            {headers.map(header => (
              <td key={header.key}>{user[header.key]}</td>
            ))}
            <td>
              {console.log(user.role)}
              {
              canEditUser(user) && (
                <button onClick={() => onEdit(user)} className="btn btn-secondary mr-8">
                  Редактировать
                </button>
              )}
              {canDeleteUser(user) && (
                <button onClick={() => onDelete(user)} className="btn btn-danger mr-8">
                  Удалить
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default UserTable;
