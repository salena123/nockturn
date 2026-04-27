import React, { useCallback, useEffect, useState } from 'react';

import api from '../api';
import useActionDialog from '../components/ui/useActionDialog';
import { formatServerDateTime } from '../utils/dateTime';


const TYPE_LABELS = {
  lesson_issue: 'Проблема на занятии',
  attendance_reschedule_required: 'Требуется перенос',
  attendance_rescheduled: 'Перенос создан',
  note_assigned: 'Назначена заметка',
  note_reminder: 'Напоминание по заметке',
};


const NotificationsPage = ({ currentUser }) => {
  const { dialog, showError, showSuccess } = useActionDialog();
  const [notifications, setNotifications] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const loadNotifications = useCallback(async () => {
    const params = typeFilter ? { params: { type: typeFilter } } : undefined;
    const response = await api.get('/api/notifications', params);
    setNotifications(response.data.filter((item) => !item.is_read));
  }, [typeFilter]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await loadNotifications();
      } catch (error) {
        await showError(error.response?.data?.detail || 'Не удалось загрузить уведомления');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [loadNotifications, showError]);

  const handleResolve = async (notificationId) => {
    try {
      await api.delete(`/api/notifications/${notificationId}`);
      await showSuccess('Уведомление отмечено как обработанное');
      await loadNotifications();
    } catch (error) {
      await showError(error.response?.data?.detail || 'Не удалось обработать уведомление');
    }
  };

  if (loading) {
    return <div>Загрузка уведомлений...</div>;
  }

  return (
    <div>
      <h2>Уведомления</h2>
      <div>Пользователь: {currentUser?.full_name || currentUser?.login}</div>

      <div>
        <label>
          Фильтр по типу
          <br />
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Все уведомления</option>
            <option value="lesson_issue">Проблемы на занятиях</option>
            <option value="attendance_reschedule_required">Требуется перенос</option>
            <option value="attendance_rescheduled">Переносы созданы</option>
            <option value="note_assigned">Назначенные заметки</option>
            <option value="note_reminder">Напоминания по заметкам</option>
          </select>
        </label>
      </div>

      {!notifications.length ? (
        <div>Новых уведомлений нет.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Тип</th>
              <th>Ученик</th>
              <th>Сотрудник</th>
              <th>Текст</th>
              <th>Дата</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {notifications.map((notification) => (
              <tr key={notification.id}>
                <td>{notification.id}</td>
                <td>{TYPE_LABELS[notification.type] || notification.type || '—'}</td>
                <td>{notification.student_name || '—'}</td>
                <td>{notification.user_name || '—'}</td>
                <td>{notification.text}</td>
                <td>{formatServerDateTime(notification.created_at)}</td>
                <td>
                  <button type="button" onClick={() => handleResolve(notification.id)}>
                    Отметить как обработанное
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog}
    </div>
  );
};


export default NotificationsPage;
