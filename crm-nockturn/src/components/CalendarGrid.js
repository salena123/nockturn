import React, { useState, useEffect } from 'react';
import api from '../api';

const pad = (value) => String(value).padStart(2, '0');

const formatLocalDate = (date) => {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const formatLocalDateTime = (date) => {
  return `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
};

const parseServerDateTime = (value) => {
  if (!value) {
    return null;
  }

  const hasTimezone = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value);
  if (hasTimezone) {
    return new Date(value);
  }

  const [datePart, timePart = '00:00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
};

const SLOT_MINUTES = 15;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 23;
const ROW_HEIGHT = 28;
const TIME_COLUMN_WIDTH = 80;

const formatApiError = (detail) => {
  if (!detail) {
    return 'Ошибка создания занятия';
  }

  if (typeof detail === 'string') {
    return detail;
  }

  const lines = [];

  if (detail.message) {
    lines.push(detail.message);
  }

  if (detail.teacher_conflicts?.length) {
    lines.push('');
    lines.push('Конфликт преподавателя:');
    detail.teacher_conflicts.forEach((conflict) => {
      lines.push(
        `- ${conflict.teacher_name || 'Преподаватель'} занят: ${conflict.time}` +
        `${conflict.discipline_name ? `, ${conflict.discipline_name}` : ''}` +
        `${conflict.room_name ? `, кабинет ${conflict.room_name}` : ''}`
      );
    });
  }

  if (detail.room_conflicts?.length) {
    lines.push('');
    lines.push('Конфликт кабинета:');
    detail.room_conflicts.forEach((conflict) => {
      lines.push(
        `- Кабинет ${conflict.room_name || conflict.room_id || ''} занят: ${conflict.time}` +
        `${conflict.teacher_name ? `, преподаватель ${conflict.teacher_name}` : ''}` +
        `${conflict.discipline_name ? `, ${conflict.discipline_name}` : ''}`
      );
    });
  }

  if (detail.student_conflicts?.length) {
    lines.push('');
    lines.push('Конфликт ученика:');
    detail.student_conflicts.forEach((conflict) => {
      lines.push(
        `- ${conflict.student_name || 'Ученик'} уже записан: ${conflict.time}` +
        `${conflict.discipline_name ? `, ${conflict.discipline_name}` : ''}` +
        `${conflict.teacher_name ? `, преподаватель ${conflict.teacher_name}` : ''}` +
        `${conflict.room_name ? `, кабинет ${conflict.room_name}` : ''}`
      );
    });
  }

  return lines.join('\n').trim() || 'Ошибка создания занятия';
};

const CalendarGrid = () => {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  
  const hours = Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => i + DAY_START_HOUR);
  const timeSlots = [];
  hours.forEach(hour => {
    for (let min = 0; min < 60; min += 15) {
      timeSlots.push(`${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`);
    }
  });

  
  const getWeekDays = (date) => {
    const week = [];
    const startOfWeek = new Date(date);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      week.push(day);
    }
    return week;
  };

  const weekDays = getWeekDays(currentWeek);

  useEffect(() => {
    fetchCalendarData();
  }, [currentWeek]);

  const fetchCalendarData = async () => {
    try {
      const startDate = formatLocalDate(weekDays[0]);
      
      const [eventsRes, teachersRes, disciplinesRes, roomsRes, studentsRes] = await Promise.all([
        api.get(`/api/schedule/calendar?start_date=${startDate}`),
        api.get('/api/teachers'),
        api.get('/api/disciplines'),
        api.get('/api/rooms'),
        api.get('/api/students')
      ]);

      setEvents(eventsRes.data);
      setTeachers(teachersRes.data);
      setDisciplines(disciplinesRes.data);
      setRooms(roomsRes.data);
      setStudents(studentsRes.data);
    } catch (error) {
      console.error('Ошибка загрузки данных календаря:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCellClick = (day, time) => {
    const [hours, minutes] = time.split(':').map(Number);
    const slotDate = new Date(day);
    slotDate.setHours(hours, minutes, 0, 0);
    
    setSelectedSlot({
      date: slotDate,
      time: time,
      day: day
    });
    setShowModal(true);
  };

  const handleCreateButtonClick = () => {
    setSelectedSlot(null);
    setShowModal(true);
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleDeleteEvent = async (eventId) => {
    const shouldDelete = window.confirm('Удалить это занятие из расписания?');
    if (!shouldDelete) {
      return;
    }

    try {
      await api.delete(`/api/schedule/events/${eventId}`);
      setSelectedEvent(null);
      await fetchCalendarData();
    } catch (error) {
      console.error('Ошибка удаления занятия:', error);
      alert(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const getEventsForDay = (day) => {
    return events
      .map((event) => ({
        ...event,
        parsedStart: parseServerDateTime(event.start_time),
        parsedEnd: parseServerDateTime(event.end_time)
      }))
      .filter((event) => {
        return (
          event.parsedStart &&
          event.parsedEnd &&
          event.parsedStart.toDateString() === day.toDateString()
        );
      })
      .sort((a, b) => a.parsedStart - b.parsedStart);
  };

  const getEventTop = (eventStart) => {
    const startOfDay = new Date(eventStart);
    startOfDay.setHours(DAY_START_HOUR, 0, 0, 0);
    const diffMinutes = Math.max(0, (eventStart.getTime() - startOfDay.getTime()) / 60000);
    return (diffMinutes / SLOT_MINUTES) * ROW_HEIGHT;
  };

  const getEventHeight = (eventStart, eventEnd) => {
    const durationMinutes = Math.max(SLOT_MINUTES, (eventEnd.getTime() - eventStart.getTime()) / 60000);
    return (durationMinutes / SLOT_MINUTES) * ROW_HEIGHT;
  };

  const getColumnEvents = (day) => {
    const dayEvents = getEventsForDay(day);
    const clusters = [];
    const positionedEvents = [];
    let activeEvents = [];
    let currentCluster = null;

    dayEvents.forEach((event) => {
      activeEvents = activeEvents.filter(
        (activeEvent) => activeEvent.parsedEnd > event.parsedStart
      );

      if (activeEvents.length === 0) {
        currentCluster = {
          id: clusters.length,
          laneCount: 0,
        };
        clusters.push(currentCluster);
      }

      const usedLanes = new Set(activeEvents.map((activeEvent) => activeEvent.laneIndex));
      let laneIndex = 0;
      while (usedLanes.has(laneIndex)) {
        laneIndex += 1;
      }

      const positionedEvent = {
        ...event,
        laneIndex,
        clusterId: currentCluster.id,
      };

      currentCluster.laneCount = Math.max(currentCluster.laneCount, laneIndex + 1);
      activeEvents.push(positionedEvent);
      positionedEvents.push(positionedEvent);
    });

    return positionedEvents.map((event) => {
      const cluster = clusters[event.clusterId];
      return {
        ...event,
        laneCount: cluster?.laneCount || 1,
      };
    });
  };

  const navigateWeek = (direction) => {
    const newWeek = new Date(currentWeek);
    newWeek.setDate(newWeek.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentWeek(newWeek);
  };

  if (loading) {
    return <div>Загрузка календаря...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Расписание</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={handleCreateButtonClick}>Добавить занятие</button>
          <button onClick={() => navigateWeek('prev')}>← Предыдущая неделя</button>
          <span>
            {weekDays[0].toLocaleDateString('ru-RU')} - {weekDays[6].toLocaleDateString('ru-RU')}
          </span>
          <button onClick={() => navigateWeek('next')}>Следующая неделя →</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
        <div style={{ display: 'flex', minWidth: '1200px' }}>
          <div style={{ width: `${TIME_COLUMN_WIDTH}px`, flexShrink: 0, borderRight: '1px solid #ddd' }}>
            <div style={{ height: '56px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Время
            </div>
            <div>
              {timeSlots.map((time) => (
                <div
                  key={time}
                  style={{
                    height: `${ROW_HEIGHT}px`,
                    borderBottom: '1px solid #eee',
                    padding: '4px',
                    boxSizing: 'border-box',
                    fontSize: '12px',
                    backgroundColor: '#f9f9f9'
                  }}
                >
                  {time}
                </div>
              ))}
            </div>
          </div>

          {weekDays.map((day, index) => {
            const dayEvents = getColumnEvents(day);

            return (
              <div key={index} style={{ flex: 1, minWidth: '150px', borderRight: index === weekDays.length - 1 ? 'none' : '1px solid #ddd' }}>
                <div style={{ height: '56px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', padding: '10px', boxSizing: 'border-box' }}>
                  <div>{['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][index]}</div>
                  <div>{day.toLocaleDateString('ru-RU')}</div>
                </div>

                <div style={{ position: 'relative', height: `${timeSlots.length * ROW_HEIGHT}px` }}>
                  {timeSlots.map((time) => (
                    <div
                      key={time}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${timeSlots.indexOf(time) * ROW_HEIGHT}px`,
                        height: `${ROW_HEIGHT}px`,
                        borderBottom: '1px solid #eee',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                      onClick={() => handleCellClick(day, time)}
                    />
                  ))}

                  {dayEvents.map((event) => {
                    const top = getEventTop(event.parsedStart);
                    const height = getEventHeight(event.parsedStart, event.parsedEnd);
                    const widthPercent = 100 / event.laneCount;
                    const leftPercent = event.laneIndex * widthPercent;

                    return (
                      <div
                        key={event.id}
                        style={{
                          position: 'absolute',
                          top: `${top}px`,
                          left: `calc(${leftPercent}% + 2px)`,
                          width: `calc(${widthPercent}% - 4px)`,
                          height: `${Math.max(height - 2, ROW_HEIGHT)}px`,
                          backgroundColor: event.type === 'lesson' ? '#4CAF50' :
                            event.type === 'event' ? '#2196F3' : '#FF9800',
                          color: 'white',
                          borderRadius: '4px',
                          padding: '4px 6px',
                          boxSizing: 'border-box',
                          fontSize: '11px',
                          overflow: 'hidden',
                          zIndex: 2,
                          cursor: 'pointer'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEventClick(event);
                        }}
                      >
                        <div><strong>{event.discipline?.name || 'Без дисциплины'}</strong></div>
                        <div>{event.parsedStart.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - {event.parsedEnd.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                        <div>{event.teacher?.specialization || '—'}</div>
                        <div>{event.room?.name}</div>
                        {event.lesson?.students?.length > 0 && (
                          <div>{event.lesson.students.map((student) => student.name).join(', ')}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {showModal && selectedSlot && (
        <LessonModal 
          showModal={showModal}
          onClose={() => setShowModal(false)}
          selectedSlot={selectedSlot}
          teachers={teachers}
          disciplines={disciplines}
          rooms={rooms}
          students={students}
          onLessonCreated={fetchCalendarData}
        />
      )}
      {showModal && !selectedSlot && (
        <LessonModal 
          showModal={showModal}
          onClose={() => setShowModal(false)}
          selectedSlot={null}
          teachers={teachers}
          disciplines={disciplines}
          rooms={rooms}
          students={students}
          onLessonCreated={fetchCalendarData}
        />
      )}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
};

const LessonModal = ({ showModal, onClose, selectedSlot, teachers, disciplines, rooms, students, onLessonCreated }) => {
  const initialDate = selectedSlot?.date || new Date();
  const [formData, setFormData] = useState({
    teacher_id: '',
    discipline_id: '',
    room_id: '',
    type: 'lesson',
    lesson_type: 'individual',
    max_students: 1,
    student_id: '',
    student_ids: [],
    duration: 45 
  });
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(initialDate));
  const [selectedTime, setSelectedTime] = useState(`${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`);
  const [studentSearch, setStudentSearch] = useState('');
  const [showDisciplineCreate, setShowDisciplineCreate] = useState(false);
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [localDisciplines, setLocalDisciplines] = useState(disciplines);
  const [localRooms, setLocalRooms] = useState(rooms);

  const durations = [];
  for (let min = 30; min <= 120; min += 15) {
    durations.push(min);
  }

  const filteredStudents = students.filter((student) => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) {
      return true;
    }

    return (
      student.fio?.toLowerCase().includes(query) ||
      student.phone?.toLowerCase().includes(query) ||
      student.email?.toLowerCase().includes(query)
    );
  });

  useEffect(() => {
    setLocalDisciplines(disciplines);
  }, [disciplines]);

  useEffect(() => {
    setLocalRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    const nextDate = selectedSlot?.date || new Date();
    setSelectedDate(formatLocalDate(nextDate));
    setSelectedTime(`${pad(nextDate.getHours())}:${pad(nextDate.getMinutes())}`);
  }, [selectedSlot, showModal]);

  const handleCreateDiscipline = async () => {
    const trimmedName = newDisciplineName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await api.post('/api/disciplines/', null, {
        params: { name: trimmedName }
      });
      setLocalDisciplines((prev) => [...prev, response.data]);
      setFormData({ ...formData, discipline_id: response.data.id });
      setNewDisciplineName('');
      setShowDisciplineCreate(false);
    } catch (error) {
      console.error('Ошибка создания дисциплины:', error);
      alert(error.response?.data?.detail || 'Ошибка создания дисциплины');
    }
  };

  const handleCreateRoom = async () => {
    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await api.post('/api/rooms/', null, {
        params: { name: trimmedName }
      });
      setLocalRooms((prev) => [...prev, response.data]);
      setFormData({ ...formData, room_id: response.data.id });
      setNewRoomName('');
      setShowRoomCreate(false);
    } catch (error) {
      console.error('Ошибка создания кабинета:', error);
      alert(error.response?.data?.detail || 'Ошибка создания кабинета');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let createdEventId = null;

    try {
      const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + formData.duration);

      
      const eventResponse = await api.post('/api/schedule/events', {
        teacher_id: formData.teacher_id,
        discipline_id: formData.discipline_id,
        room_id: formData.room_id,
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
        type: formData.type
      });
      createdEventId = eventResponse.data.id;

      
      await api.post('/api/schedule/lessons', {
        schedule_id: eventResponse.data.id,
        lesson_date: formatLocalDate(startTime),
        lesson_type: formData.lesson_type,
        max_students: formData.max_students,
        student_ids: formData.lesson_type === 'group'
          ? formData.student_ids
          : (formData.student_id ? [formData.student_id] : [])
      });

      onLessonCreated();
      onClose();
    } catch (error) {
      console.error('Ошибка создания занятия:', error);
      if (createdEventId) {
        try {
          await api.delete(`/api/schedule/events/${createdEventId}`);
        } catch (rollbackError) {
          console.error('Ошибка отката события:', rollbackError);
        }
      }
      alert(formatApiError(error.response?.data?.detail));
    }
  };

  if (!showModal) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, 
      left: 0, 
      right: 0, 
      bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{ 
        backgroundColor: 'white', 
        padding: '20px', 
        borderRadius: '8px', 
        width: '600px',
        maxHeight: '80vh',
        overflowY: 'auto'
      }}>
        <h3>Новое занятие</h3>
        {selectedSlot ? (
          <p>
            {selectedSlot.day.toLocaleDateString('ru-RU')} в {selectedSlot.time}
          </p>
        ) : (
          <p>Выберите дату и время занятия</p>
        )}
        
        <form onSubmit={handleSubmit}>
          {!selectedSlot && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label>Дата:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label>Время начала:</label>
                <input
                  type="time"
                  step="900"
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  required
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label>Тип занятия:</label>
            <select
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            >
              <option value="lesson">Урок</option>
              <option value="event">Мероприятие</option>
              <option value="masterclass">Мастер-класс</option>
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Формат занятия:</label>
            <select
              value={formData.lesson_type}
              onChange={(e) => setFormData({
                ...formData,
                lesson_type: e.target.value,
                max_students: e.target.value === 'group' ? Math.max(formData.max_students, 2) : 1,
                student_id: '',
                student_ids: []
              })}
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            >
              <option value="individual">Индивидуальное</option>
              <option value="group">Групповое</option>
            </select>
          </div>

          {formData.lesson_type === 'individual' && (
            <div style={{ marginBottom: '15px' }}>
              <label>Ученик:</label>
              <select
                value={formData.student_id}
                onChange={(e) => setFormData({...formData, student_id: e.target.value ? parseInt(e.target.value) : ''})}
                required
                style={{ width: '100%', padding: '5px', marginTop: '5px' }}
              >
                <option value="">Выберите ученика</option>
                {students.map(student => (
                  <option key={student.id} value={student.id}>
                    {student.fio}
                  </option>
                ))}
              </select>
            </div>
          )}

          {formData.lesson_type === 'group' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label>Количество учеников:</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={formData.max_students}
                  onChange={(e) => setFormData({...formData, max_students: parseInt(e.target.value)})}
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label>Поиск учеников:</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Введите ФИО, телефон или email"
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label>Ученики:</label>
                <div style={{ border: '1px solid #ccc', marginTop: '5px', padding: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {filteredStudents.length === 0 ? (
                    <div>Ученики не найдены</div>
                  ) : (
                    filteredStudents.map((student) => {
                      const isChecked = formData.student_ids.includes(student.id);

                      return (
                        <label key={student.id} style={{ display: 'block', marginBottom: '6px' }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({
                                  ...formData,
                                  student_ids: [...formData.student_ids, student.id]
                                });
                              } else {
                                setFormData({
                                  ...formData,
                                  student_ids: formData.student_ids.filter((id) => id !== student.id)
                                });
                              }
                            }}
                          />{' '}
                          {student.fio}
                          {student.phone ? ` (${student.phone})` : ''}
                        </label>
                      );
                    })
                  )}
                </div>
                <div style={{ marginTop: '6px', fontSize: '12px' }}>
                  Выбрано учеников: {formData.student_ids.length}
                </div>
              </div>
            </>
          )}

          <div style={{ marginBottom: '15px' }}>
            <label>Преподаватель:</label>
            <select
              value={formData.teacher_id}
              onChange={(e) => setFormData({...formData, teacher_id: parseInt(e.target.value)})}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            >
              <option value="">Выберите преподавателя</option>
              {teachers.map(teacher => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user?.full_name || 'N/A'} ({teacher.specialization || '—'})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Дисциплина:</label>
            <select
              value={formData.discipline_id}
              onChange={(e) => setFormData({...formData, discipline_id: parseInt(e.target.value)})}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            >
              <option value="">Выберите дисциплину</option>
              {localDisciplines.map(discipline => (
                <option key={discipline.id} value={discipline.id}>
                  {discipline.name}
                </option>
              ))}
            </select>
            <div style={{ marginTop: '5px' }}>
              <button type="button" onClick={() => setShowDisciplineCreate(!showDisciplineCreate)}>
                {showDisciplineCreate ? 'Отменить' : 'Добавить дисциплину'}
              </button>
            </div>
            {showDisciplineCreate && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={newDisciplineName}
                  onChange={(e) => setNewDisciplineName(e.target.value)}
                  placeholder="Название дисциплины"
                  style={{ width: '100%', padding: '5px' }}
                />
                <button type="button" onClick={handleCreateDiscipline} style={{ marginTop: '5px' }}>
                  Сохранить дисциплину
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Кабинет:</label>
            <select
              value={formData.room_id}
              onChange={(e) => setFormData({...formData, room_id: parseInt(e.target.value)})}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            >
              <option value="">Выберите кабинет</option>
              {localRooms.map(room => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
            <div style={{ marginTop: '5px' }}>
              <button type="button" onClick={() => setShowRoomCreate(!showRoomCreate)}>
                {showRoomCreate ? 'Отменить' : 'Добавить кабинет'}
              </button>
            </div>
            {showRoomCreate && (
              <div style={{ marginTop: '8px' }}>
                <input
                  type="text"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  placeholder="Название кабинета"
                  style={{ width: '100%', padding: '5px' }}
                />
                <button type="button" onClick={handleCreateRoom} style={{ marginTop: '5px' }}>
                  Сохранить кабинет
                </button>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Длительность:</label>
            <select
              value={formData.duration}
              onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            >
              {durations.map(duration => (
                <option key={duration} value={duration}>
                  {duration} мин
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '8px 16px' }}>
              Отмена
            </button>
            <button type="submit" style={{ padding: '8px 16px', backgroundColor: '#4CAF50', color: 'white', border: 'none' }}>
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const EventDetailsModal = ({ event, onClose, onDelete }) => {
  const eventStart = parseServerDateTime(event.start_time);
  const eventEnd = parseServerDateTime(event.end_time);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1100
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '20px',
          borderRadius: '8px',
          width: '420px'
        }}
      >
        <h3>Занятие</h3>
        <p>{event.discipline?.name || 'Без дисциплины'}</p>
        <p>
          {eventStart?.toLocaleDateString('ru-RU')} {' '}
          {eventStart?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} - {' '}
          {eventEnd?.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
        </p>
        <p>Преподаватель: {event.teacher?.specialization || '—'}</p>
        <p>Кабинет: {event.room?.name || '—'}</p>
        {event.lesson?.students?.length > 0 && (
          <p>Ученики: {event.lesson.students.map((student) => student.name).join(', ')}</p>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose}>
            Закрыть
          </button>
          <button
            type="button"
            onClick={() => onDelete(event.id)}
            style={{ backgroundColor: '#c62828', color: 'white', border: 'none', padding: '8px 16px' }}
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;
