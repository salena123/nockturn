import React, { useState, useEffect } from 'react';
import api from '../api';

const SchedulePage = () => {
  const [events, setEvents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [formData, setFormData] = useState({
    teacher_id: '',
    discipline_id: '',
    room_id: '',
    start_time: '',
    end_time: '',
    type: 'lesson'
  });

  useEffect(() => {
    fetchScheduleData();
  }, []);

  const fetchScheduleData = async () => {
    try {
      const [eventsRes, teachersRes, disciplinesRes, roomsRes] = await Promise.all([
        api.get('/api/schedule/events'),
        api.get('/api/users'),
        api.get('/api/disciplines'),
        api.get('/api/rooms')
      ]);

      setEvents(eventsRes.data);
      setTeachers(teachersRes.data.filter(user => user.role === 'teacher'));
      setDisciplines(disciplinesRes.data);
      setRooms(roomsRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных расписания:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEvent) {
        await api.put(`/api/schedule/events/${editingEvent.id}`, formData);
      } else {
        await api.post('/api/schedule/events', formData);
      }
      
      fetchScheduleData();
      resetForm();
    } catch (error) {
      console.error('Ошибка сохранения события:', error);
      alert(error.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleEdit = (event) => {
    setEditingEvent(event);
    setFormData({
      teacher_id: event.teacher_id,
      discipline_id: event.discipline_id,
      room_id: event.room_id,
      start_time: event.start_time.slice(0, 16),
      end_time: event.end_time.slice(0, 16),
      type: event.type
    });
    setShowForm(true);
  };

  const handleDelete = async (eventId) => {
    if (window.confirm('Удалить это событие?')) {
      try {
        await api.delete(`/api/schedule/events/${eventId}`);
        fetchScheduleData();
      } catch (error) {
        console.error('Ошибка удаления:', error);
      }
    }
  };

  const resetForm = () => {
    setFormData({
      teacher_id: '',
      discipline_id: '',
      room_id: '',
      start_time: '',
      end_time: '',
      type: 'lesson'
    });
    setEditingEvent(null);
    setShowForm(false);
  };

  if (loading) {
    return <div>Загрузка расписания...</div>;
  }

  return (
    <div>
      <h2>Расписание</h2>
      
      <button onClick={() => setShowForm(true)}>
        Добавить событие
      </button>

      {showForm && (
        <div style={{ border: '1px solid #ccc', padding: '20px', margin: '20px 0' }}>
          <h3>{editingEvent ? 'Редактировать событие' : 'Новое событие'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '10px' }}>
              <label>Преподаватель:</label>
              <select
                value={formData.teacher_id}
                onChange={(e) => setFormData({...formData, teacher_id: e.target.value})}
                required
              >
                <option value="">Выберите преподавателя</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Дисциплина:</label>
              <select
                value={formData.discipline_id}
                onChange={(e) => setFormData({...formData, discipline_id: e.target.value})}
                required
              >
                <option value="">Выберите дисциплину</option>
                {disciplines.map(discipline => (
                  <option key={discipline.id} value={discipline.id}>
                    {discipline.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Кабинет:</label>
              <select
                value={formData.room_id}
                onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                required
              >
                <option value="">Выберите кабинет</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Время начала:</label>
              <input
                type="datetime-local"
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                required
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Время окончания:</label>
              <input
                type="datetime-local"
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                required
              />
            </div>

            <div style={{ marginBottom: '10px' }}>
              <label>Тип:</label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({...formData, type: e.target.value})}
              >
                <option value="lesson">Урок</option>
                <option value="event">Мероприятие</option>
                <option value="masterclass">Мастер-класс</option>
              </select>
            </div>

            <button type="submit">
              {editingEvent ? 'Сохранить' : 'Создать'}
            </button>
            <button type="button" onClick={resetForm}>
              Отмена
            </button>
          </form>
        </div>
      )}

      <div style={{ marginTop: '20px' }}>
        <h3>События расписания</h3>
        <table border="1" cellPadding="8" cellSpacing="0">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Время</th>
              <th>Преподаватель</th>
              <th>Дисциплина</th>
              <th>Кабинет</th>
              <th>Тип</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {events.map(event => (
              <tr key={event.id}>
                <td>{new Date(event.start_time).toLocaleDateString()}</td>
                <td>
                  {new Date(event.start_time).toLocaleTimeString()} - 
                  {new Date(event.end_time).toLocaleTimeString()}
                </td>
                <td>{event.teacher?.specialization || 'N/A'}</td>
                <td>{event.discipline?.name || 'N/A'}</td>
                <td>{event.room?.name || 'N/A'}</td>
                <td>{event.type}</td>
                <td>
                  <button onClick={() => handleEdit(event)}>
                    Редактировать
                  </button>
                  <button onClick={() => handleDelete(event.id)}>
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SchedulePage;
