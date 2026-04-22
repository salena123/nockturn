import React, { useEffect, useState } from 'react';
import DeleteConfirm from '../components/DeleteConfirm';
import UserForm from '../components/UserForm';
import UserTable from '../components/UserTable';
import UserSuccessModal from '../components/UserSuccessModal';
import api from '../api';

const Users = ({ currentUser }) => {
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successUserData, setSuccessUserData] = useState(null);
  const [successPassword, setSuccessPassword] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

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

  
  const handleUserCreated = async () => {
    await loadUsers();
    setEditingUser(null);
  };

  const handleUserUpdated = async () => {
    await loadUsers();
    setEditingUser(null);
  };

  const handleUserSuccess = (userData, generatedPassword, isEdit) => {
    setSuccessUserData(userData);
    setSuccessPassword(generatedPassword);
    setIsEditMode(isEdit);
    setSuccessModalOpen(true);
  };

  const handleToggleBlock = async (user) => {
    try {
      
      const endpoint = user.is_active
        ? `/api/users/${user.id}/block`
        : `/api/users/${user.id}/unblock`;
      await api.post(endpoint);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка изменения статуса пользователя');
    }
  };

  const handleDelete = async () => {
    try {
      
      await api.delete(`/api/users/${deletingUser.id}`);
      setDeletingUser(null);
      await loadUsers();
    } catch (err) {
      setError(err.response?.data?.detail || 'Ошибка удаления пользователя');
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
          currentUser={currentUser}
          onUserCreated={handleUserCreated}
          onUserUpdated={handleUserUpdated}
          onUserSuccess={handleUserSuccess}
          onCancel={() => setEditingUser(null)}
        />
      )}

      <UserTable
        users={users}
        currentUser={currentUser}
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

      <UserSuccessModal
        isOpen={successModalOpen}
        onClose={() => setSuccessModalOpen(false)}
        user={successUserData}
        generatedPassword={successPassword}
        isEdit={isEditMode}
      />
    </div>
  );
};


export default Users;
