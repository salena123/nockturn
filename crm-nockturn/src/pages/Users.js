import React, { useState, useEffect } from 'react';
import api from '../api';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/api/users');
        setUsers(response.data);
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2>Пользователи</h2>
      {users.map(user => (
        <div key={user.id}>
          {user.email} ({user.role})
        </div>
      ))}
    </div>
  );
};

export default Users;