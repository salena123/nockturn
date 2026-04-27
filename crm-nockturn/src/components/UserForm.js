import React, { useEffect, useState } from 'react';
import api from '../api';


const EMPTY_FORM = {
  login: '',
  password: '',
  full_name: '',
  phone: '',
  role_id: '',
  is_active: true,
  hire_date: '',
  generate_password: false,
};

const ROLE_LABELS = {
  admin: 'Администратор',
  teacher: 'Преподаватель',
  superadmin: 'Суперадминистратор',
};

const getRoleLabel = (roleName) => ROLE_LABELS[roleName] || roleName || '';

const UserForm = ({
  user,
  roles,
  currentUser,
  onUserCreated,
  onUserUpdated,
  onUserSuccess,
  onCancel,
}) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const availableRoles = roles.filter((role) => role.name !== 'superadmin');

  useEffect(() => {
    if (user?.id) {
      setFormData({
        login: user.login || '',
        password: '',
        full_name: user.full_name || '',
        phone: user.phone || '',
        role_id: user.role_id ? String(user.role_id) : '',
        is_active: user.is_active ?? true,
        hire_date: user.hire_date || '',
        generate_password: false,
      });
      setError('');
      return;
    }

    setFormData(EMPTY_FORM);
    setError('');
  }, [user]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    if (!user?.id && !formData.generate_password && formData.password) {
      if (formData.password.length < 8) {
        setError('Пароль должен быть не короче 8 символов');
        setLoading(false);
        return;
      }
      const hasLetter = /[^\d\s]/.test(formData.password);
      const hasDigit = /\d/.test(formData.password);
      if (!hasLetter || !hasDigit) {
        setError('Пароль должен содержать буквы и цифры');
        setLoading(false);
        return;
      }
    }

    if (!user?.id && !formData.password && !formData.generate_password) {
      setError('Введите пароль или включите автоматическую генерацию');
      setLoading(false);
      return;
    }

    try {
      if (user?.id) {
        await api.put(`/api/users/${user.id}`, {
          login: formData.login,
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          role_id: formData.role_id ? Number(formData.role_id) : null,
          is_active: formData.is_active,
          hire_date: formData.hire_date || null,
        });

        let currentGeneratedPassword = '';
        if (formData.password || formData.generate_password) {
          const resetResponse = await api.post(`/api/users/${user.id}/reset-password`, {
            password: formData.password || null,
            generate_password: formData.generate_password,
          });
          currentGeneratedPassword = resetResponse.data.generated_password || '';
        }

        const updatedUserData = {
          login: formData.login,
          full_name: formData.full_name,
          phone: formData.phone,
          role: availableRoles.find((role) => role.id === Number(formData.role_id))?.name,
          is_active: formData.is_active,
        };

        if (onUserSuccess) {
          onUserSuccess(updatedUserData, currentGeneratedPassword, true);
        }

        if (onUserUpdated) {
          onUserUpdated();
        }
      } else {
        const userData = {
          login: formData.login,
          password: formData.password || null,
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          role_id: Number(formData.role_id),
          is_active: formData.is_active,
          hire_date: formData.hire_date || null,
          generate_password: formData.generate_password,
        };
        const response = await api.post('/api/users', userData);
        const currentGeneratedPassword = response.data.generated_password || '';

        const newUserData = {
          login: formData.login,
          full_name: formData.full_name,
          phone: formData.phone,
          role: availableRoles.find((role) => role.id === Number(formData.role_id))?.name,
          is_active: formData.is_active,
        };

        if (onUserSuccess) {
          onUserSuccess(newUserData, currentGeneratedPassword, false);
        }

        if (onUserCreated) {
          onUserCreated();
        }
      }
    } catch (err) {
      if (err.response?.data?.detail && Array.isArray(err.response.data.detail)) {
        const validationErrors = err.response.data.detail;
        const errorMessages = validationErrors.map((validationError) => {
          const fieldName = validationError.loc[1];
          const message = validationError.msg;

          if (message.includes('at least 3 characters')) {
            return 'Логин: минимум 3 символа';
          }
          if (message.includes('at least 8 characters')) {
            return 'Пароль: минимум 8 символов';
          }
          if (message.includes('String should have at least')) {
            return `${fieldName}: минимум ${validationError.ctx?.min_length || ''} символов`;
          }
          return message;
        });
        setError(errorMessages.join('. '));
      } else {
        setError(err.response?.data?.detail || 'Ошибка сохранения пользователя');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>{user?.id ? 'Редактирование сотрудника' : 'Новый сотрудник'}</h3>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Логин
            <br />
            <input
              type="text"
              name="login"
              value={formData.login}
              onChange={handleChange}
              required
            />
          </label>
        </div>

        <div>
          <label>
            ФИО
            <br />
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Телефон
            <br />
            <input
              type="text"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Роль
            <br />
            {user?.id && user.id === currentUser?.id ? (
              <div>
                <input
                  type="text"
                  value={getRoleLabel(availableRoles.find((role) => role.id === Number(formData.role_id))?.name)}
                  disabled
                  style={{ backgroundColor: '#f5f5f5', color: '#666' }}
                />
              </div>
            ) : (
              <select
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
                required
              >
                <option value="">Выберите роль</option>
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getRoleLabel(role.name)}
                  </option>
                ))}
              </select>
            )}
          </label>
        </div>

        <div>
          <label>
            Дата начала работы
            <br />
            <input
              type="date"
              name="hire_date"
              value={formData.hire_date}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Пароль
            <br />
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={user?.id ? 'Оставьте пустым, если не меняете' : ''}
            />
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="generate_password"
              checked={formData.generate_password}
              onChange={handleChange}
            />
            Сгенерировать пароль автоматически
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
            />
            Учётная запись активна
          </label>
        </div>

        {error && <div>{error}</div>}

        <button type="submit" disabled={loading}>
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>{' '}
        <button type="button" onClick={onCancel}>
          Отмена
        </button>
      </form>
    </div>
  );
};


export default UserForm;
