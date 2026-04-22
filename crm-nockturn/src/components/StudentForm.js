import React, { useEffect, useState } from 'react';
import api from '../api';


const EMPTY_FORM = {
  fio: '',
  phone: '',
  email: '',
  has_parent: false,
  parent_name: '',
  parent_phone: '',
  parent_telegram_id: '',
  address: '',
  level: '',
  status: 'потенциальный',
  comment: '',
  first_contact_date: '',
  birth_date: '',
};

const LEVELS = ['начальный', 'средний', 'продвинутый'];
const STATUSES = ['потенциальный', 'активный', 'заморожен', 'отказался'];


const StudentForm = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
        status: student.status || 'потенциальный',
        comment: student.comment || '',
        first_contact_date: student.first_contact_date || '',
        birth_date: student.birth_date || '',
      });
      setError('');
      return;
    }

    setFormData(EMPTY_FORM);
    setError('');
  }, [student]);

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

    try {
      const payload = {
        fio: formData.fio,
        phone: formData.phone || null,
        email: formData.email || null,
        has_parent: formData.has_parent,
        parent_name: formData.has_parent ? formData.parent_name || null : null,
        parent_phone: formData.has_parent ? formData.parent_phone || null : null,
        parent_telegram_id:
          formData.has_parent && formData.parent_telegram_id
            ? Number(formData.parent_telegram_id)
            : null,
        address: formData.address || null,
        level: formData.level || null,
        status: formData.status || null,
        comment: formData.comment || null,
        first_contact_date: formData.first_contact_date || null,
        birth_date: formData.birth_date || null,
      };

      if (student?.id) {
        await api.put(`/api/students/${student.id}`, payload);
      } else {
        await api.post('/api/students', payload);
      }

      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить клиента');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h3>{student?.id ? 'Редактирование клиента' : 'Новый клиент'}</h3>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            ФИО ученика
            <br />
            <input type="text" name="fio" value={formData.fio} onChange={handleChange} required />
          </label>
        </div>

        <div>
          <label>
            Дата рождения
            <br />
            <input type="date" name="birth_date" value={formData.birth_date} onChange={handleChange} />
          </label>
        </div>

        <div>
          <label>
            Телефон
            <br />
            <input type="text" name="phone" value={formData.phone} onChange={handleChange} />
          </label>
        </div>

        <div>
          <label>
            Email
            <br />
            <input type="email" name="email" value={formData.email} onChange={handleChange} />
          </label>
        </div>

        <div>
          <label>
            Адрес
            <br />
            <textarea name="address" value={formData.address} onChange={handleChange} rows="3" />
          </label>
        </div>

        <div>
          <label>
            Уровень подготовки
            <br />
            <select name="level" value={formData.level} onChange={handleChange}>
              <option value="">Выберите уровень</option>
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Статус
            <br />
            <select name="status" value={formData.status} onChange={handleChange}>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Дата первого обращения
            <br />
            <input
              type="date"
              name="first_contact_date"
              value={formData.first_contact_date}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Комментарий
            <br />
            <textarea name="comment" value={formData.comment} onChange={handleChange} rows="4" />
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              name="has_parent"
              checked={formData.has_parent}
              onChange={handleChange}
            />
            Есть ответственное лицо
          </label>
        </div>

        {formData.has_parent && (
          <>
            <div>
              <label>
                ФИО ответственного лица
                <br />
                <input
                  type="text"
                  name="parent_name"
                  value={formData.parent_name}
                  onChange={handleChange}
                  required={formData.has_parent}
                />
              </label>
            </div>

            <div>
              <label>
                Телефон ответственного
                <br />
                <input
                  type="text"
                  name="parent_phone"
                  value={formData.parent_phone}
                  onChange={handleChange}
                />
              </label>
            </div>

            <div>
              <label>
                Telegram ID ответственного
                <br />
                <input
                  type="number"
                  name="parent_telegram_id"
                  value={formData.parent_telegram_id}
                  onChange={handleChange}
                />
              </label>
            </div>
          </>
        )}

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


export default StudentForm;
