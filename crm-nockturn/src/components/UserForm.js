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


const UserForm = ({ user, roles, onSave, onCancel }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');

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
      setGeneratedPassword('');
      setError('');
      return;
    }

    setFormData(EMPTY_FORM);
    setGeneratedPassword('');
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
    setGeneratedPassword('');

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

        if (formData.password || formData.generate_password) {
          const resetResponse = await api.post(`/api/users/${user.id}/reset-password`, {
            password: formData.password || null,
            generate_password: formData.generate_password,
          });
          setGeneratedPassword(resetResponse.data.generated_password || '');
        }
      } else {
        const response = await api.post('/api/users', {
          login: formData.login,
          password: formData.password || null,
          full_name: formData.full_name || null,
          phone: formData.phone || null,
          role_id: Number(formData.role_id),
          is_active: formData.is_active,
          hire_date: formData.hire_date || null,
          generate_password: formData.generate_password,
        });
        setGeneratedPassword(response.data.generated_password || '');
      }

      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить сотрудника');
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
            Логин (email)
            <br />
            <input
              type="email"
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
            <select
              name="role_id"
              value={formData.role_id}
              onChange={handleChange}
              required
            >
              <option value="">Выберите роль</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
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
        {generatedPassword && (
          <div>
            <strong>Сгенерированный пароль:</strong> {generatedPassword}
          </div>
        )}

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
