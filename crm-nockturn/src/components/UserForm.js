import React, { useState, useEffect } from 'react';
import api from '../api';

const UserForm = ({ user, currentUser, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    login: '',
    password: '',
    role: 'teacher'
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        login: user.login,
        password: '',
        role: user.role
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (user) {
        const updateData = {};
        
        if (canEditLogin()) {
          updateData.login = formData.login;
        }
        
        if (canEditRole()) {
          updateData.role = formData.role;
        }
        
        if (user.id !== currentUser.id && formData.password) {
          updateData.password = formData.password;
        }
        
        if (user.id === currentUser.id && formData.password) {
          updateData.password = formData.password;
        }
        
        await api.put(`/api/users/${user.id}`, updateData);
      } else {
        await api.post('/api/users', formData);
      }
      
      onSave();
    } catch (error) {
      console.error('Ошибка сохранения пользователя:', error);
    } finally {
      setLoading(false);
    }
  };

  const canEditLogin = () => {
    if (!user) return true;
    return user.id !== currentUser.id || currentUser.role === 'superadmin';
  };

  const canEditRole = () => {
    if (!user) return true;
    return user.id !== currentUser.id;
  };

  const canEditAdminRole = () => {
    if (currentUser.role === 'admin') {
      return ['teacher']
    }
    else {
      return ['teacher', 'admin']
    }
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '4px' }}>
      <h3>{user ? 'Редактировать пользователя' : 'Добавить пользователя'}</h3>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>
            Логин:
            <input
              type="text"
              name="login"
              value={formData.login}
              onChange={handleChange}
              disabled={!canEditLogin()}
              style={{ marginLeft: '10px', padding: '5px', backgroundColor: canEditLogin() ? 'white' : '#f5f5f5' }}
            />
            {!canEditLogin() && <small style={{ marginLeft: '10px', color: '#666' }}>Нельзя изменить свой логин</small>}
          </label>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label>
            Пароль:
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={user ? 'Оставьте пустым если не меняете' : ''}
              style={{ marginLeft: '10px', padding: '5px' }}
            />
          </label>
        </div>

        {canEditRole() && (
          <div style={{ marginBottom: '15px' }}>
            <label>
              Роль:
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                style={{ marginLeft: '10px', padding: '5px' }}
              >
                {
                  canEditAdminRole().map(role => (
                    <option key={role} value={role}>{role === 'admin' ? 'Админ' : role === 'teacher' ? 'Учитель' : role}</option>
                  ))
                }
              </select>
            </label>
          </div>
        )}

        <div>
          <button type="submit" disabled={loading} style={{ marginRight: '10px' }}>
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
