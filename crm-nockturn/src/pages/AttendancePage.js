import React, { useEffect, useState } from 'react';
import api from '../api';


const EMPTY_FORM = {
  lesson_id: '',
  student_id: '',
  subscription_id: '',
  status: 'done',
  comment: '',
  price_per_lesson: '',
};

const STATUSES = [
  { value: 'done', label: 'Проведено' },
  { value: 'miss_valid', label: 'Пропуск по уважительной причине' },
  { value: 'miss_invalid', label: 'Пропуск без уважительной причины' },
];


const AttendancePage = () => {
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    try {
      const [recordsResponse, studentsResponse, subscriptionsResponse] = await Promise.all([
        api.get('/api/attendance'),
        api.get('/api/students'),
        api.get('/api/subscriptions'),
      ]);
      setRecords(recordsResponse.data);
      setStudents(studentsResponse.data);
      setSubscriptions(subscriptionsResponse.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить посещаемость');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      await loadData();
      setLoading(false);
    };

    load();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
  };

  const buildPayload = () => ({
    lesson_id: Number(formData.lesson_id),
    student_id: Number(formData.student_id),
    subscription_id: formData.subscription_id ? Number(formData.subscription_id) : null,
    status: formData.status,
    comment: formData.comment || null,
    price_per_lesson: formData.price_per_lesson ? Number(formData.price_per_lesson) : null,
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingId) {
        await api.put(`/api/attendance/${editingId}`, buildPayload());
      } else {
        await api.post('/api/attendance', buildPayload());
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить посещаемость');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (record) => {
    setEditingId(record.id);
    setFormData({
      lesson_id: record.lesson_id ? String(record.lesson_id) : '',
      student_id: record.student_id ? String(record.student_id) : '',
      subscription_id: record.subscription_id ? String(record.subscription_id) : '',
      status: record.status || 'done',
      comment: record.comment || '',
      price_per_lesson: record.price_per_lesson ?? '',
    });
  };

  const handleDelete = async (recordId) => {
    try {
      await api.delete(`/api/attendance/${recordId}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить запись посещаемости');
    }
  };

  if (loading) {
    return <div>Загрузка посещаемости...</div>;
  }

  return (
    <div>
      <h2>Посещаемость</h2>

      {error && <div>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            ID занятия
            <br />
            <input name="lesson_id" value={formData.lesson_id} onChange={handleChange} required />
          </label>
        </div>

        <div>
          <label>
            Ученик
            <br />
            <select name="student_id" value={formData.student_id} onChange={handleChange} required>
              <option value="">Выберите ученика</option>
              {students.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fio}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Договор
            <br />
            <select name="subscription_id" value={formData.subscription_id} onChange={handleChange}>
              <option value="">Не выбран</option>
              {subscriptions.map((subscription) => (
                <option key={subscription.id} value={subscription.id}>
                  #{subscription.id} / student {subscription.student_id}
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
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Цена за занятие
            <br />
            <input name="price_per_lesson" value={formData.price_per_lesson} onChange={handleChange} />
          </label>
        </div>

        <div>
          <label>
            Комментарий
            <br />
            <textarea name="comment" value={formData.comment} onChange={handleChange} rows="3" />
          </label>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Сохранение...' : editingId ? 'Сохранить изменения' : 'Создать запись'}
        </button>{' '}
        <button type="button" onClick={resetForm}>
          Сбросить форму
        </button>
      </form>

      <h3>Список записей</h3>
      {!records.length ? (
        <div>Записи посещаемости не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Занятие</th>
              <th>Ученик</th>
              <th>Договор</th>
              <th>Статус</th>
              <th>Цена</th>
              <th>Списано</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.lesson_id || ''}</td>
                <td>{record.student_id || ''}</td>
                <td>{record.subscription_id || ''}</td>
                <td>{record.status || ''}</td>
                <td>{record.price_per_lesson ?? ''}</td>
                <td>{record.is_charged ? 'Да' : 'Нет'}</td>
                <td>{record.comment || ''}</td>
                <td>
                  <button type="button" onClick={() => handleEdit(record)}>
                    Редактировать
                  </button>{' '}
                  <button type="button" onClick={() => handleDelete(record.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};


export default AttendancePage;
