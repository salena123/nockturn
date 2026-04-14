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
  if (user?.id) {
    setFormData({
      login: user.login,
      password: '',
      role: user.role
    });
  } else {
    setFormData({
      login: '',
      password: '',
      role: 'teacher'
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
      if (user?.id) {
        const updateData = {};

        if (canEditLogin()) {
          updateData.login = formData.login;
        }

        if (canEditRole()) {
          updateData.role = formData.role;
        }

        if (formData.password) {
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
    <div className="form-container">
      <h3>{user?.id ? 'Редактировать пользователя' : 'Добавить пользователя'}</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>
            Логин:
            <input
              type="text"
              name="login"
              value={formData.login}
              onChange={handleChange}
              disabled={!canEditLogin()}
              className={canEditLogin() ? 'form-input' : 'form-input disabled'}
            />
            {!canEditLogin() && <small className="form-help-text">Нельзя изменить свой логин</small>}
          </label>
        </div>

        <div className="form-group">
          <label>
            Пароль:
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={user ? 'Оставьте пустым если не меняете' : ''}
              className="form-input"
            />
          </label>
        </div>

        {canEditRole() && (
          <div className="form-group">
            <label>
              Роль:
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="form-input"
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
          <button type="submit" disabled={loading} className="btn btn-primary mr-10">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default UserForm;
