import React, { useEffect, useState } from 'react';
import DeleteConfirm from '../components/DeleteConfirm';
import UserForm from '../components/UserForm';
import UserTable from '../components/UserTable';
import api from '../api';


const Users = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const loadUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить сотрудников');
    }
  };

  const loadRoles = async () => {
    try {
      const response = await api.get('/api/roles');
      setRoles(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить роли');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      await Promise.all([loadUsers(), loadRoles()]);
      setLoading(false);
    };

    load();
  }, []);

  const handleSave = async () => {
    setEditingUser(null);
    await loadUsers();
  };

  const handleToggleBlock = async (user) => {
    try {
      const endpoint = user.is_active
        ? `/api/users/${user.id}/block`
        : `/api/users/${user.id}/unblock`;
      await api.post(endpoint);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось изменить статус сотрудника');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/users/${deletingUser.id}`);
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить сотрудника');
    }
  };

  if (currentUser?.role === 'teacher') {
    return <div>Раздел сотрудников доступен только администратору.</div>;
  }

  if (loading) {
    return <div>Загрузка сотрудников...</div>;
  }

  return (
    <div>
      <h2>Сотрудники</h2>

      {error && <div>{error}</div>}

      <button type="button" onClick={() => setEditingUser({})}>
        Добавить сотрудника
      </button>

      {editingUser !== null && (
        <UserForm
          user={editingUser}
          roles={roles}
          onSave={handleSave}
          onCancel={() => setEditingUser(null)}
        />
      )}

      <UserTable
        users={users}
        onEdit={setEditingUser}
        onDelete={setDeletingUser}
        onToggleBlock={handleToggleBlock}
      />

      {deletingUser && (
        <DeleteConfirm
          item={deletingUser}
          itemType="user"
          onConfirm={handleDelete}
          onCancel={() => setDeletingUser(null)}
        />
      )}
    </div>
  );
};


export default Users;
