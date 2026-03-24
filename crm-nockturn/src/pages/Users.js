import React, { useState, useEffect } from 'react';
import api from '../api';
import UserTable from '../components/UserTable';
import UserForm from '../components/UserForm';
import DeleteConfirm from '../components/DeleteConfirm';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return null

        const responseMe = await api.get('/api/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setCurrentUser(responseMe.data);

        const response = await api.get('/api/users');
        setUsers(response.data);
      } catch (error) {
        console.error('Ошибка загрузки пользователей:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const canAddUser = () => {
    return currentUser && (currentUser.role === 'admin' || currentUser.role === 'superadmin');
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setShowForm(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDeleteUser = (user) => {
    setDeletingUser(user);
    setShowDeleteConfirm(true);
  };

  const handleSaveUser = () => {
    setShowForm(false);
    setEditingUser(null);
    api.get('/api/users')
      .then(response => setUsers(response.data))
      .catch(error => console.error('Ошибка перезагрузки пользователей:', error));
  };

  const handleCancelUser = () => {
    setShowForm(false);
    setEditingUser(null);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/api/users/${deletingUser.id}`);
      setUsers(users.filter(user => user.id !== deletingUser.id));
      setShowDeleteConfirm(false);
      setDeletingUser(null);
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      alert('Ошибка удаления пользователя');
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingUser(null);
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2>Пользователи</h2>
      
      {canAddUser() && (
        <button onClick={handleAddUser} style={{ marginBottom: '20px' }}>
          Добавить пользователя
        </button>
      )}

      {showForm && (
        <UserForm
          user={editingUser}
          currentUser={currentUser}
          onSave={handleSaveUser}
          onCancel={handleCancelUser}
        />
      )}

      <UserTable
        users={users}
        currentUser={currentUser}
        onEdit={handleEditUser}
        onDelete={handleDeleteUser}
      />

      {showDeleteConfirm && (
        <DeleteConfirm
          item={deletingUser}
          itemType="user"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default Users;