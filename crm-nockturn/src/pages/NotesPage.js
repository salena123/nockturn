import React, { useCallback, useEffect, useMemo, useState } from 'react';

import api from '../api';
import useActionDialog from '../components/ui/useActionDialog';
import { formatServerDateTime } from '../utils/dateTime';


const PRIORITY_LABELS = {
  normal: 'Обычная',
  important: 'Важная',
};


const BOX_LABELS = {
  all: 'Все мои заметки',
  authored: 'Созданные мной',
  received: 'Порученные мне',
};


const NotesPage = ({ currentUser }) => {
  const { dialog, showConfirm, showError, showSuccess } = useActionDialog();
  const [notes, setNotes] = useState([]);
  const [history, setHistory] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);
  const [box, setBox] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [form, setForm] = useState({
    text: '',
    reminder_at: '',
    recipient_user_id: '',
    priority: 'normal',
    is_pinned: false,
  });

  const loadData = useCallback(async () => {
    const params = { box };
    if (priorityFilter) {
      params.priority = priorityFilter;
    }

    const [notesResponse, historyResponse, usersResponse] = await Promise.all([
      api.get('/api/notes', { params }),
      api.get('/api/notes/history'),
      api.get('/api/notes/staff-users'),
    ]);

    setNotes(notesResponse.data);
    setHistory(historyResponse.data);
    setStaffUsers(usersResponse.data);
  }, [box, priorityFilter]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await loadData();
      } catch (error) {
        await showError(error.response?.data?.detail || 'Не удалось загрузить заметки');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [loadData, showError]);

  const resetForm = () => {
    setEditingNoteId(null);
    setForm({
      text: '',
      reminder_at: '',
      recipient_user_id: '',
      priority: 'normal',
      is_pinned: false,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const payload = {
      text: form.text.trim(),
      reminder_at: form.reminder_at || null,
      recipient_user_id: form.recipient_user_id ? Number(form.recipient_user_id) : null,
      priority: form.priority,
      is_pinned: form.is_pinned,
    };

    if (!payload.text) {
      await showError('Текст заметки обязателен');
      return;
    }

    try {
      if (editingNoteId) {
        await api.put(`/api/notes/${editingNoteId}`, payload);
        await showSuccess('Заметка обновлена');
      } else {
        await api.post('/api/notes', payload);
        await showSuccess('Заметка создана');
      }
      resetForm();
      await loadData();
    } catch (error) {
      await showError(error.response?.data?.detail || 'Не удалось сохранить заметку');
    }
  };

  const handleEdit = (note) => {
    setEditingNoteId(note.id);
    setForm({
      text: note.text || '',
      reminder_at: note.reminder_at ? note.reminder_at.slice(0, 16) : '',
      recipient_user_id: note.recipient_user_id ? String(note.recipient_user_id) : '',
      priority: note.priority || 'normal',
      is_pinned: Boolean(note.is_pinned),
    });
  };

  const handleDelete = async (note) => {
    const confirmed = await showConfirm(
      `Удалить заметку "${note.text.length > 40 ? `${note.text.slice(0, 40)}...` : note.text}"?`,
      'Удаление заметки',
      'Удалить'
    );
    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/api/notes/${note.id}`);
      await showSuccess('Заметка удалена');
      if (editingNoteId === note.id) {
        resetForm();
      }
      await loadData();
    } catch (error) {
      await showError(error.response?.data?.detail || 'Не удалось удалить заметку');
    }
  };

  const staffOptions = useMemo(
    () =>
      staffUsers
        .filter((user) => user.id !== currentUser?.id)
        .map((user) => ({
          value: String(user.id),
          label: `${user.full_name || user.login} (${user.role || 'сотрудник'})`,
        })),
    [currentUser?.id, staffUsers]
  );

  if (loading) {
    return <div>Загрузка заметок...</div>;
  }

  return (
    <div>
      <h2>Заметки и напоминания</h2>

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Текст заметки
            <br />
            <textarea
              rows="4"
              value={form.text}
              onChange={(event) => setForm((prev) => ({ ...prev, text: event.target.value }))}
            />
          </label>
        </div>

        <div>
          <label>
            Напомнить
            <br />
            <input
              type="datetime-local"
              value={form.reminder_at}
              onChange={(event) => setForm((prev) => ({ ...prev, reminder_at: event.target.value }))}
            />
          </label>
        </div>

        <div>
          <label>
            Кому поручить
            <br />
            <select
              value={form.recipient_user_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, recipient_user_id: event.target.value }))
              }
            >
              <option value="">Только мне</option>
              {staffOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div>
          <label>
            Приоритет
            <br />
            <select
              value={form.priority}
              onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))}
            >
              <option value="normal">Обычная</option>
              <option value="important">Важная</option>
            </select>
          </label>
        </div>

        <div>
          <label>
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(event) => setForm((prev) => ({ ...prev, is_pinned: event.target.checked }))}
            />
            {' '}Закрепить сверху
          </label>
        </div>

        <div>
          <button type="submit">{editingNoteId ? 'Сохранить заметку' : 'Создать заметку'}</button>
          {editingNoteId && (
            <button type="button" onClick={resetForm}>
              Отменить редактирование
            </button>
          )}
        </div>
      </form>

      <hr />

      <div>
        <label>
          Раздел
          <br />
          <select value={box} onChange={(event) => setBox(event.target.value)}>
            {Object.entries(BOX_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Приоритет
          <br />
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="">Все</option>
            <option value="normal">Обычные</option>
            <option value="important">Важные</option>
          </select>
        </label>
      </div>

      {!notes.length ? (
        <div>Заметок пока нет.</div>
      ) : (
        <div>
          {notes.map((note) => (
            <div
              key={note.id}
              style={{
                border: '1px solid #ccc',
                padding: 12,
                margin: '12px 0',
                background: note.priority === 'important' ? '#fff4d6' : '#fff',
              }}
            >
              <div><strong>{PRIORITY_LABELS[note.priority] || note.priority}</strong>{note.is_pinned ? ' • Закреплено' : ''}</div>
              <div>{note.text}</div>
              <div>Автор: {note.author_name || '—'}</div>
              <div>Исполнитель: {note.recipient_user_name || 'Только автор'}</div>
              <div>Напомнить: {note.reminder_at ? formatServerDateTime(note.reminder_at) : 'Без напоминания'}</div>
              <div>Обновлено: {formatServerDateTime(note.updated_at || note.created_at)}</div>
              <div>
                <button type="button" onClick={() => handleEdit(note)}>
                  Редактировать
                </button>
                <button type="button" onClick={() => handleDelete(note)}>
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <hr />

      <h3>История заметок</h3>
      {!history.length ? (
        <div>История заметок пока пуста.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Сотрудник</th>
              <th>Действие</th>
              <th>Поле</th>
              <th>Было</th>
              <th>Стало</th>
            </tr>
          </thead>
          <tbody>
            {history.map((item) => (
              <tr key={item.id}>
                <td>{formatServerDateTime(item.created_at)}</td>
                <td>{item.actor_user_name || '—'}</td>
                <td>{item.action}</td>
                <td>{item.field_name || '—'}</td>
                <td>{item.old_value || '—'}</td>
                <td>{item.new_value || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialog}
    </div>
  );
};


export default NotesPage;
