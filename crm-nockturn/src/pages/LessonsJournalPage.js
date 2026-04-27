import React, { useEffect, useMemo, useState } from 'react';

import api from '../api';
import { formatServerDate, formatServerDateTime } from '../utils/dateTime';


const STATUS_LABELS = {
  done: 'Проведено',
  miss_valid: 'Пропуск по уважительной причине',
  miss_invalid: 'Пропуск без уважительной причины',
};

const EMPTY_BULK_FORM = {
  teacher_id: '',
  source_date: '',
  target_date: '',
};

const EMPTY_RESCHEDULE_FORM = {
  attendance_id: null,
  new_date: '',
  start_time: '',
  end_time: '',
  room_id: '',
};


const LessonsJournalPage = ({ currentUser }) => {
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [selectedLesson, setSelectedLesson] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [issues, setIssues] = useState([]);
  const [teacherFilter, setTeacherFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [bulkForm, setBulkForm] = useState(EMPTY_BULK_FORM);
  const [rescheduleForm, setRescheduleForm] = useState(EMPTY_RESCHEDULE_FORM);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadLessons = async () => {
    const response = await api.get('/api/schedule/lessons');
    setLessons(response.data);
  };

  const loadReferences = async () => {
    const [teachersResponse, roomsResponse] = await Promise.all([
      api.get('/api/teachers'),
      api.get('/api/rooms'),
    ]);
    setTeachers(teachersResponse.data);
    setRooms(roomsResponse.data);
  };

  const loadLessonDetails = async (lesson) => {
    const [attendanceResponse, issuesResponse] = await Promise.all([
      api.get('/api/attendance', { params: { lesson_id: lesson.id } }),
      api.get(`/api/lessons/${lesson.id}/issues`),
    ]);
    setAttendance(attendanceResponse.data);
    setIssues(issuesResponse.data);
    setSelectedLesson(lesson);
  };

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        await Promise.all([loadLessons(), loadReferences()]);
      } catch (err) {
        setError(err.response?.data?.detail || 'Не удалось загрузить журнал занятий');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredLessons = useMemo(() => {
    return lessons.filter((lesson) => {
      const teacherMatches = teacherFilter
        ? String(lesson.schedule?.teacher_id || lesson.schedule?.teacher?.id || lesson.schedule?.teacher?.user_id) === teacherFilter
        : true;
      const lessonDate = lesson.lesson_date || lesson.schedule?.start_time?.slice?.(0, 10) || '';
      const fromMatches = dateFrom ? lessonDate >= dateFrom : true;
      const toMatches = dateTo ? lessonDate <= dateTo : true;
      return teacherMatches && fromMatches && toMatches;
    });
  }, [dateFrom, dateTo, lessons, teacherFilter]);

  const handleOpenLesson = async (lesson) => {
    try {
      await loadLessonDetails(lesson);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось открыть журнал занятия');
    }
  };

  const handleBulkReschedule = async (event) => {
    event.preventDefault();
    try {
      await api.post('/api/schedule/bulk-reschedule', {
        teacher_id: Number(bulkForm.teacher_id),
        source_date: bulkForm.source_date,
        target_date: bulkForm.target_date,
      });
      setBulkForm(EMPTY_BULK_FORM);
      await loadLessons();
      if (selectedLesson) {
        await loadLessonDetails(selectedLesson);
      }
    } catch (err) {
      setError(err.response?.data?.detail?.message || err.response?.data?.detail || 'Не удалось массово перенести занятия');
    }
  };

  const handleCreateReschedule = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        new_start_time: `${rescheduleForm.new_date}T${rescheduleForm.start_time}:00`,
        new_end_time: `${rescheduleForm.new_date}T${rescheduleForm.end_time}:00`,
        room_id: rescheduleForm.room_id ? Number(rescheduleForm.room_id) : null,
      };
      await api.post(`/api/attendance/${rescheduleForm.attendance_id}/reschedule`, payload);
      setRescheduleForm(EMPTY_RESCHEDULE_FORM);
      await loadLessons();
      if (selectedLesson) {
        await loadLessonDetails(selectedLesson);
      }
    } catch (err) {
      setError(err.response?.data?.detail?.message || err.response?.data?.detail || 'Не удалось создать перенос занятия');
    }
  };

  const openRescheduleForm = (record) => {
    const baseDate = selectedLesson?.lesson_date || '';
    setRescheduleForm({
      attendance_id: record.id,
      new_date: baseDate,
      start_time: '10:00',
      end_time: '10:45',
      room_id: selectedLesson?.schedule?.room?.id ? String(selectedLesson.schedule.room.id) : '',
    });
  };

  if (loading) {
    return <div>Загрузка журнала занятий...</div>;
  }

  return (
    <div>
      <h2>Журнал занятий</h2>

      {error && <div>{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

      {currentUser?.role !== 'teacher' && (
        <form onSubmit={handleBulkReschedule}>
          <h3>Массовый перенос занятий преподавателя</h3>
          <label>
            Преподаватель
            <br />
            <select
              value={bulkForm.teacher_id}
              onChange={(event) => setBulkForm((prev) => ({ ...prev, teacher_id: event.target.value }))}
              required
            >
              <option value="">Выберите преподавателя</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.user?.full_name || teacher.specialization || `#${teacher.id}`}
                </option>
              ))}
            </select>
          </label>{' '}
          <label>
            С какой даты
            <br />
            <input
              type="date"
              value={bulkForm.source_date}
              onChange={(event) => setBulkForm((prev) => ({ ...prev, source_date: event.target.value }))}
              required
            />
          </label>{' '}
          <label>
            На какую дату
            <br />
            <input
              type="date"
              value={bulkForm.target_date}
              onChange={(event) => setBulkForm((prev) => ({ ...prev, target_date: event.target.value }))}
              required
            />
          </label>{' '}
          <button type="submit">Перенести все занятия</button>
        </form>
      )}

      <h3>Список занятий</h3>
      <div>
        <label>
          Преподаватель
          <br />
          <select value={teacherFilter} onChange={(event) => setTeacherFilter(event.target.value)}>
            <option value="">Все преподаватели</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.user?.full_name || teacher.specialization || `#${teacher.id}`}
              </option>
            ))}
          </select>
        </label>{' '}
        <label>
          Дата с
          <br />
          <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
        </label>{' '}
        <label>
          Дата по
          <br />
          <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </label>
      </div>

      {!filteredLessons.length ? (
        <div>Занятия не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Дата</th>
              <th>Преподаватель</th>
              <th>Дисциплина</th>
              <th>Кабинет</th>
              <th>Тип урока</th>
              <th>Ученики</th>
              <th>Проблемы</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredLessons.map((lesson) => (
              <tr key={lesson.id}>
                <td>{lesson.id}</td>
                <td>{formatServerDate(lesson.lesson_date)}</td>
                <td>{lesson.teacher_name || '—'}</td>
                <td>{lesson.schedule?.discipline?.name || '—'}</td>
                <td>{lesson.schedule?.room?.name || '—'}</td>
                <td>{lesson.lesson_type === 'group' ? 'Групповое' : 'Индивидуальное'}</td>
                <td>{lesson.students?.map((student) => student.fio).join(', ') || '—'}</td>
                <td>{lesson.issues?.length || 0}</td>
                <td>
                  <button type="button" onClick={() => handleOpenLesson(lesson)}>
                    Открыть журнал
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {selectedLesson && (
        <div>
          <h3>Журнал занятия #{selectedLesson.id}</h3>
          <div>
            <strong>Дата:</strong> {formatServerDate(selectedLesson.lesson_date)}
            <br />
            <strong>Преподаватель:</strong> {selectedLesson.teacher_name || '—'}
            <br />
            <strong>Дисциплина:</strong> {selectedLesson.schedule?.discipline?.name || '—'}
            <br />
            <strong>Кабинет:</strong> {selectedLesson.schedule?.room?.name || '—'}
          </div>

          <h4>Посещаемость</h4>
          {!attendance.length ? (
            <div>Записей посещаемости пока нет.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Ученик</th>
                  <th>Статус</th>
                  <th>Остаток занятий</th>
                  <th>Комментарий</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((record) => (
                  <tr key={record.id}>
                    <td>{record.id}</td>
                    <td>{record.student_name || '—'}</td>
                    <td>{STATUS_LABELS[record.status] || record.status}</td>
                    <td>{record.subscription_balance ?? '—'}</td>
                    <td>{record.comment || '—'}</td>
                    <td>
                      {record.status === 'miss_valid' && currentUser?.role !== 'teacher' ? (
                        <button type="button" onClick={() => openRescheduleForm(record)}>
                          Создать перенос
                        </button>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {rescheduleForm.attendance_id && (
            <form onSubmit={handleCreateReschedule}>
              <h4>Создание переноса занятия</h4>
              <label>
                Дата
                <br />
                <input
                  type="date"
                  value={rescheduleForm.new_date}
                  onChange={(event) => setRescheduleForm((prev) => ({ ...prev, new_date: event.target.value }))}
                  required
                />
              </label>{' '}
              <label>
                Время начала
                <br />
                <input
                  type="time"
                  value={rescheduleForm.start_time}
                  onChange={(event) => setRescheduleForm((prev) => ({ ...prev, start_time: event.target.value }))}
                  required
                />
              </label>{' '}
              <label>
                Время окончания
                <br />
                <input
                  type="time"
                  value={rescheduleForm.end_time}
                  onChange={(event) => setRescheduleForm((prev) => ({ ...prev, end_time: event.target.value }))}
                  required
                />
              </label>{' '}
              <label>
                Кабинет
                <br />
                <select
                  value={rescheduleForm.room_id}
                  onChange={(event) => setRescheduleForm((prev) => ({ ...prev, room_id: event.target.value }))}
                >
                  <option value="">Оставить исходный кабинет</option>
                  {rooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>{' '}
              <button type="submit">Создать перенос</button>{' '}
              <button type="button" onClick={() => setRescheduleForm(EMPTY_RESCHEDULE_FORM)}>
                Отмена
              </button>
            </form>
          )}

          <h4>Проблемы по занятию</h4>
          {!issues.length ? (
            <div>Проблем по этому занятию нет.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Описание</th>
                  <th>Создано</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.id}</td>
                    <td>{issue.description}</td>
                    <td>{formatServerDateTime(issue.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
};


export default LessonsJournalPage;
