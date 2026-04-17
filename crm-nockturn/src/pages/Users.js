import React, { useState, useEffect } from 'react';
import api from '../api';
import UserTable from '../components/UserTable';
import UserForm from '../components/UserForm';
import DeleteConfirm from '../components/DeleteConfirm';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

  const loadUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/api/me');
        setCurrentUser(res.data);
      } catch (error) {
        console.error('Ошибка инициализации:', error);
      }
    };

    init();
  }, []);

  useEffect(() => {
  if (!currentUser) return;

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки учеников:', error);
    } finally {
      setLoading(false);
    }
  };

  fetchUsers();
}, [currentUser]);

  const canAddUser =
    currentUser?.role === 'admin' || currentUser?.role === 'superadmin';

  const openCreate = () => setEditingUser({});
  const openEdit = (user) => setEditingUser(user);

  const closeForm = () => setEditingUser(null);

  const handleSave = async () => {
    closeForm();
    await loadUsers();
  };

  const handleDelete = (user) => setDeletingUser(user);

  const confirmDelete = async () => {
    try {
      await api.delete(`/api/users/${deletingUser.id}`);
      setUsers(users.filter(u => u.id !== deletingUser.id));
      setDeletingUser(null);
    } catch (error) {
      console.error('Ошибка удаления:', error);
    }
  };

  const cancelDelete = () => setDeletingUser(null);

  if (loading) return <div>Загрузка...</div>;
  if (currentUser?.role === 'teacher') {
  return <h3>Преподавателям недоступен список пользователей</h3>;
}

  return (
    <div>
      <h2>Пользователи</h2>

      {canAddUser && (
        <button onClick={openCreate} className="btn btn-primary mb-20">
          Добавить пользователя
        </button>
      )}

      {editingUser !== null && (
        <UserForm
          user={editingUser}
          currentUser={currentUser}
          onSave={handleSave}
          onCancel={closeForm}
        />
      )}

      <UserTable
        users={users}
        currentUser={currentUser}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      {deletingUser && (
        <DeleteConfirm
          item={deletingUser}
          itemType="user"
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
        />
      )}
    </div>
  );
};

export default Users;