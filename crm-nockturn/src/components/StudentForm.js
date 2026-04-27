import React, { useEffect, useState } from 'react';

import api from '../api';
import { formatServerDateTime } from '../utils/dateTime';


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

const LEVEL_OPTIONS = [
  { value: 'начальный', label: 'Начальный' },
  { value: 'средний', label: 'Средний' },
  { value: 'продвинутый', label: 'Продвинутый' },
];

const STATUS_OPTIONS = [
  { value: 'потенциальный', label: 'Потенциальный' },
  { value: 'активный', label: 'Активный' },
  { value: 'заморожен', label: 'Заморожен' },
  { value: 'отказался', label: 'Отказался' },
];

const normalizeStudentStatus = (status) => {
  if (!status) {
    return 'потенциальный';
  }

  return status === 'новый' ? 'потенциальный' : status;
};


const BLOCKED_STATUSES = new Set(['заморожен', 'отказался']);


const StudentForm = ({ student, onSave, onCancel, currentUser }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusWarning, setStatusWarning] = useState(null);

  useEffect(() => {
    if (student?.id) {
      setFormData({
        fio: student.fio || '',
        phone: student.phone || '',
        email: student.email || '',
        has_parent: Boolean(student.has_parent),
        parent_name: student.parent_name || '',
        parent_phone: student.parent?.phone || '',
        parent_telegram_id: student.parent?.telegram_id ? String(student.parent.telegram_id) : '',
        address: student.address || '',
        level: student.level || '',
        status: normalizeStudentStatus(student.status),
        comment: student.comment || '',
        first_contact_date: student.first_contact_date || '',
        birth_date: student.birth_date || '',
      });
      setError('');
      setStatusWarning(null);
      return;
    }

    setFormData(EMPTY_FORM);
    setError('');
    setStatusWarning(null);
  }, [student]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const submitStudent = async ({ skipStatusWarning = false } = {}) => {
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

      const isAdminLike = currentUser?.role === 'admin' || currentUser?.role === 'superadmin';
      const previousStatus = normalizeStudentStatus(student?.status);
      const nextStatus = normalizeStudentStatus(formData.status);
      const movingToBlockedStatus =
        Boolean(student?.id) &&
        isAdminLike &&
        BLOCKED_STATUSES.has(nextStatus) &&
        previousStatus !== nextStatus;

      if (movingToBlockedStatus && !skipStatusWarning) {
        const summaryResponse = await api.get(`/api/students/${student.id}/upcoming-lessons-summary`);
        const summary = summaryResponse.data;
        if (summary?.upcoming_lessons_count > 0) {
          setStatusWarning(summary);
          setLoading(false);
          return;
        }
      }

      if (student?.id) {
        await api.put(`/api/students/${student.id}`, payload);
      } else {
        await api.post('/api/students', payload);
      }

      setStatusWarning(null);
      onSave();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить ученика');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitStudent();
  };

  return (
    <div>
      <h3>{student?.id ? 'Редактирование ученика' : 'Новый ученик'}</h3>

      {statusWarning && (
        <div style={{ marginBottom: 16, padding: 12, border: '1px solid #d39e00', backgroundColor: '#fff3cd' }}>
          <strong>Предупреждение</strong>
          <div style={{ marginTop: 8 }}>
            У ученика есть будущие занятия: {statusWarning.upcoming_lessons_count}.
            При смене статуса на {formData.status === 'заморожен' ? '«Заморожен»' : '«Отказался»'} занятия не удалятся автоматически.
          </div>
          {statusWarning.items?.length > 0 && (
            <div style={{ marginTop: 8 }}>
              Ближайшие занятия:
              <ul style={{ marginTop: 6, marginBottom: 6 }}>
                {statusWarning.items.map((item) => (
                  <li key={item.lesson_id}>
                    {formatServerDateTime(item.start_time)}
                    {item.discipline_name ? `, ${item.discipline_name}` : ''}
                    {item.teacher_name ? `, ${item.teacher_name}` : ''}
                    {item.room_name ? `, кабинет ${item.room_name}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div>
            <button type="button" onClick={() => submitStudent({ skipStatusWarning: true })} disabled={loading}>
              Все равно сохранить
            </button>{' '}
            <button type="button" onClick={() => setStatusWarning(null)} disabled={loading}>
              Вернуться к редактированию
            </button>
          </div>
        </div>
      )}

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
            <input
              type="date"
              name="birth_date"
              value={formData.birth_date}
              onChange={handleChange}
            />
          </label>
        </div>

        <div>
          <label>
            Основной телефон
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
            Адрес проживания
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
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Статус ученика
            <br />
            <select name="status" value={formData.status} onChange={handleChange}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
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
            {' '}Есть ответственное лицо
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
                Телефон ответственного лица
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
                Telegram ID ответственного лица
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
