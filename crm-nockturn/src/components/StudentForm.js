import React, { useState, useEffect } from 'react';
import api from '../api';

const StudentForm = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    fio: '',
    phone: '',
    email: '',
    has_parent: false,
    parent_name: '',
    parent_phone: '',
    parent_telegram_id: '',
    address: '',
    level: '',
    status: '',
    comment: '',
    first_contact_date: '',
    birth_date: ''
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student?.id) {
      setFormData({
        fio: student.fio || '',
        phone: student.phone || '',
        email: student.email || '',
        has_parent: student.has_parent || false,
        parent_name: student.parent_name || '',
        parent_phone: student.parent?.phone || '',
        parent_telegram_id: student.parent?.telegram_id ? String(student.parent.telegram_id) : '',
        address: student.address || '',
        level: student.level || '',
        status: student.status || '',
        comment: student.comment || '',
        first_contact_date: student.first_contact_date ? new Date(student.first_contact_date).toISOString().split('T')[0] : '',
        birth_date: student.birth_date ? new Date(student.birth_date).toISOString().split('T')[0] : ''
      });
    } else {
      setFormData({
        fio: '',
        phone: '',
        email: '',
        has_parent: false,
        parent_name: '',
        parent_phone: '',
        parent_telegram_id: '',
        address: '',
        level: '',
        status: '',
        comment: '',
        first_contact_date: '',
        birth_date: ''
      });
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        fio: formData.fio,
        phone: formData.phone,
        email: formData.email,
        has_parent: formData.has_parent,
        parent_name: formData.has_parent ? formData.parent_name : null,
        parent_phone: formData.has_parent ? formData.parent_phone : null,
        parent_telegram_id: formData.has_parent && formData.parent_telegram_id ? Number(formData.parent_telegram_id) : null,
        address: formData.address || null,
        level: formData.level || null,
        status: formData.status || null,
        comment: formData.comment || null,
        first_contact_date: formData.first_contact_date || null,
        birth_date: formData.birth_date || null
      };

      if (student?.id) {
        await api.put(`/api/students/${student.id}`, submitData);
      } else {
        await api.post('/api/students', submitData);
      }

      onSave();
    } catch (error) {
      console.error('Ошибка сохранения ученика:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h3>
        {student?.id ? 'Редактировать ученика' : 'Добавить ученика'}
      </h3>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>
            ФИО:
            <input
              type="text"
              name="fio"
              value={formData.fio}
              onChange={handleChange}
              required
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Телефон:
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Адрес:
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              className="form-input"
              rows="3"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Уровень:
            <input
              type="text"
              name="level"
              value={formData.level}
              onChange={handleChange}
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Статус:
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="form-input"
            >
              <option value="">Выберите статус</option>
              <option value="новый">Новый</option>
              <option value="активный">Активный</option>
              <option value="приостановлен">Приостановлен</option>
              <option value="окончил">Окончил</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            Дата первого контакта:
            <input
              type="date"
              name="first_contact_date"
              value={formData.first_contact_date}
              onChange={handleChange}
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Дата рождения:
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Комментарий:
            <textarea
              name="comment"
              value={formData.comment}
              onChange={handleChange}
              className="form-input"
              rows="3"
              placeholder="Дополнительная информация об ученике"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="has_parent"
              checked={formData.has_parent}
              onChange={handleChange}
              className="form-checkbox"
            />
            Есть родитель
          </label>
        </div>

        {formData.has_parent && (
          <>
            <div className="form-group">
              <label>
                Имя родителя:
                <input
                  type="text"
                  name="parent_name"
                  value={formData.parent_name}
                  onChange={handleChange}
                  required={formData.has_parent}
                  className="form-input"
                />
              </label>
            </div>

            <div className="form-group">
              <label>
                Телефон родителя:
                <input
                  type="tel"
                  name="parent_phone"
                  value={formData.parent_phone}
                  onChange={handleChange}
                  className="form-input"
                />
              </label>
            </div>

            <div className="form-group">
              <label>
                Telegram ID родителя:
                <input
                  type="number"
                  name="parent_telegram_id"
                  value={formData.parent_telegram_id}
                  onChange={handleChange}
                  className="form-input"
                  placeholder="ID пользователя в Telegram (необязательно)"
                />
              </label>
            </div>
          </>
        )}

        <div>
          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary mr-10"
          >
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="btn btn-secondary"
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudentForm;