import React, { useEffect, useMemo, useState } from 'react';

import api from '../api';


const EMPTY_FORM = {
  lesson_id: '',
  student_id: '',
  status: 'done',
  comment: '',
};

const STATUSES = [
  { value: 'done', label: 'Проведено' },
  { value: 'miss_valid', label: 'Пропуск по уважительной причине' },
  { value: 'miss_invalid', label: 'Пропуск без уважительной причины' },
];

const ISSUE_FORM = {
  description: '',
};

const STATUS_LABELS = {
  done: 'Проведено',
  miss_valid: 'Пропуск по уважительной причине',
  miss_invalid: 'Пропуск без уважительной причины',
};


function pickCurrentSubscription(subscriptions, lesson) {
  if (!subscriptions.length) {
    return null;
  }

  const lessonDate = lesson?.lesson_date || null;
  const candidates = lessonDate
    ? subscriptions.filter((subscription) => {
        const startsOk = !subscription.start_date || subscription.start_date <= lessonDate;
        const endsOk = !subscription.end_date || subscription.end_date >= lessonDate;
        return startsOk && endsOk;
      })
    : subscriptions;

  if (!candidates.length) {
    return null;
  }

  const activeCandidates = candidates.filter((subscription) => subscription.status === 'active');
  const normalizedCandidates = activeCandidates.length ? activeCandidates : candidates;

  return normalizedCandidates[0] || null;
}


function formatLessonLabel(lesson) {
  if (!lesson) {
    return '';
  }

  const schedule = lesson.schedule || {};
  const startTime = schedule.start_time ? new Date(schedule.start_time) : null;
  const endTime = schedule.end_time ? new Date(schedule.end_time) : null;
  const dateLabel = startTime && !Number.isNaN(startTime.getTime())
    ? startTime.toLocaleDateString('ru-RU')
    : (lesson.lesson_date || '');
  const timeLabel = startTime && endTime
    ? `${startTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}-${endTime.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`
    : '';

  return `#${lesson.id} • ${dateLabel}${timeLabel ? ` • ${timeLabel}` : ''}${schedule.teacher_name ? ` • ${schedule.teacher_name}` : ''}${schedule.discipline_name ? ` • ${schedule.discipline_name}` : ''}`;
}


const AttendancePage = () => {
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [issues, setIssues] = useState([]);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [issueForm, setIssueForm] = useState(ISSUE_FORM);
  const [issueSubmitting, setIssueSubmitting] = useState(false);
  const [lessonFilter, setLessonFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');

  const selectedLesson = useMemo(
    () => lessons.find((lesson) => String(lesson.id) === String(formData.lesson_id)) || null,
    [lessons, formData.lesson_id],
  );

  const availableStudents = useMemo(() => {
    if (selectedLesson?.students?.length) {
      return selectedLesson.students;
    }
    return students;
  }, [selectedLesson, students]);

  const selectedStudent = useMemo(
    () => availableStudents.find((student) => String(student.id) === String(formData.student_id)) || null,
    [availableStudents, formData.student_id],
  );

  const selectedSubscription = useMemo(
    () => pickCurrentSubscription(subscriptions, selectedLesson),
    [subscriptions, selectedLesson],
  );

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesLesson = lessonFilter ? String(record.lesson_id) === lessonFilter : true;
      const matchesStudent = studentFilter ? String(record.student_id) === studentFilter : true;
      return matchesLesson && matchesStudent;
    });
  }, [lessonFilter, records, studentFilter]);

  const loadData = async () => {
    try {
      const [recordsResponse, studentsResponse, lessonsResponse] = await Promise.all([
        api.get('/api/attendance'),
        api.get('/api/students'),
        api.get('/api/schedule/lessons'),
      ]);
      setRecords(recordsResponse.data);
      setStudents(studentsResponse.data);
      setLessons(lessonsResponse.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить посещаемость');
    }
  };

  const loadSubscriptions = async (studentId) => {
    if (!studentId) {
      setSubscriptions([]);
      return;
    }

    try {
      const response = await api.get(`/api/students/${studentId}/subscriptions`);
      setSubscriptions(response.data);
    } catch (err) {
      setSubscriptions([]);
      setError(err.response?.data?.detail || 'Не удалось загрузить абонементы ученика');
    }
  };

  const loadIssues = async (lessonId) => {
    if (!lessonId) {
      setIssues([]);
      return;
    }

    try {
      const response = await api.get(`/api/lessons/${lessonId}/issues`);
      setIssues(response.data);
    } catch (err) {
      setIssues([]);
      setError(err.response?.data?.detail || 'Не удалось загрузить проблемы занятия');
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

  useEffect(() => {
    if (!formData.lesson_id) {
      setIssues([]);
      return;
    }
    loadIssues(formData.lesson_id);
  }, [formData.lesson_id]);

  useEffect(() => {
    if (!formData.student_id) {
      setSubscriptions([]);
      return;
    }
    loadSubscriptions(formData.student_id);
  }, [formData.student_id]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((prev) => {
      if (name === 'lesson_id') {
        return {
          ...prev,
          lesson_id: value,
          student_id: '',
        };
      }

      if (name === 'student_id') {
        return {
          ...prev,
          student_id: value,
        };
      }

      return { ...prev, [name]: value };
    });
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setSubscriptions([]);
    setIssues([]);
    setIssueForm(ISSUE_FORM);
  };

  const buildPayload = () => ({
    lesson_id: Number(formData.lesson_id),
    student_id: Number(formData.student_id),
    status: formData.status,
    comment: formData.comment || null,
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

  const handleEdit = async (record) => {
    setEditingId(record.id);
    setFormData({
      lesson_id: record.lesson_id ? String(record.lesson_id) : '',
      student_id: record.student_id ? String(record.student_id) : '',
      status: record.status || 'done',
      comment: record.comment || '',
    });
    await loadIssues(record.lesson_id);
    if (record.student_id) {
      await loadSubscriptions(record.student_id);
    }
  };

  const handleDelete = async (recordId) => {
    try {
      await api.delete(`/api/attendance/${recordId}`);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить запись посещаемости');
    }
  };

  const handleIssueSubmit = async (event) => {
    event.preventDefault();
    if (!formData.lesson_id) {
      setError('Сначала выберите занятие, для которого хотите добавить проблему');
      return;
    }

    setIssueSubmitting(true);
    setError('');

    try {
      await api.post(`/api/lessons/${formData.lesson_id}/issues`, {
        description: issueForm.description,
      });
      setIssueForm(ISSUE_FORM);
      await loadIssues(formData.lesson_id);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить проблему занятия');
    } finally {
      setIssueSubmitting(false);
    }
  };

  const handleIssueDelete = async (issueId) => {
    try {
      await api.delete(`/api/lesson-issues/${issueId}`);
      await loadIssues(formData.lesson_id);
      await loadData();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить проблему занятия');
    }
  };

  if (loading) {
    return <div>Загрузка посещаемости...</div>;
  }

  return (
    <div>
      <h2>Посещаемость</h2>

      {error && <div>{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

      <form onSubmit={handleSubmit}>
        <div>
          <label>
            Занятие
            <br />
            <select name="lesson_id" value={formData.lesson_id} onChange={handleChange} required>
              <option value="">Выберите занятие</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {formatLessonLabel(lesson)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedLesson && (
          <div>
            <strong>Выбрано:</strong> {formatLessonLabel(selectedLesson)}
            <br />
            <strong>Тип урока:</strong> {selectedLesson.lesson_type === 'group' ? 'Групповое' : 'Индивидуальное'}
            <br />
            <strong>Кабинет:</strong> {selectedLesson.schedule?.room_name || 'Не указан'}
          </div>
        )}

        <div>
          <label>
            Ученик
            <br />
            <select name="student_id" value={formData.student_id} onChange={handleChange} required>
              <option value="">Выберите ученика</option>
              {availableStudents.map((student) => (
                <option key={student.id} value={student.id}>
                  {student.fio}
                </option>
              ))}
            </select>
          </label>
        </div>

        {selectedStudent && (
          <div>
            <strong>Статус ученика:</strong> {selectedStudent.status || 'Не указан'}
            <br />
            <strong>Телефон:</strong> {selectedStudent.phone || 'Не указан'}
          </div>
        )}

        {selectedStudent && (
          <div>
            <strong>Привязанный абонемент:</strong>{' '}
            {selectedSubscription ? `#${selectedSubscription.id}` : 'Не найден'}
            <br />
            <strong>Стоимость занятия по договору:</strong>{' '}
            {selectedSubscription?.price_per_lesson ?? 'Не указана'}
            <br />
            <strong>Остаток занятий:</strong>{' '}
            {selectedSubscription?.balance_lessons ?? 'Не указан'}
            {!selectedSubscription && selectedLesson && (
              <>
                <br />
                <strong>Причина:</strong> на дату занятия {selectedLesson.lesson_date || ''} нет подходящего абонемента ученика
              </>
            )}
          </div>
        )}

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
            Комментарий к занятию
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

      <h3>Проблемы на занятии</h3>
      {!formData.lesson_id ? (
        <div>Выберите занятие, чтобы посмотреть или добавить проблемы по оборудованию.</div>
      ) : (
        <div>
          <form onSubmit={handleIssueSubmit}>
            <div>
              <label>
                Что нужно передать администратору
                <br />
                <textarea
                  rows="3"
                  value={issueForm.description}
                  onChange={(event) => setIssueForm({ description: event.target.value })}
                  placeholder="Например: не работает микрофон, не хватает батареек"
                  required
                />
              </label>
            </div>
            <button type="submit" disabled={issueSubmitting}>
              {issueSubmitting ? 'Сохранение...' : 'Добавить проблему'}
            </button>
          </form>

          {!issues.length ? (
            <div>Проблем по выбранному занятию пока нет.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Описание</th>
                  <th>Создано</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => (
                  <tr key={issue.id}>
                    <td>{issue.id}</td>
                    <td>{issue.description}</td>
                    <td>{issue.created_at || ''}</td>
                    <td>
                      <button type="button" onClick={() => handleIssueDelete(issue.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <h3>Список записей</h3>
      <div>
        <label>
          Фильтр по занятию
          <br />
          <select value={lessonFilter} onChange={(event) => setLessonFilter(event.target.value)}>
            <option value="">Все занятия</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {formatLessonLabel(lesson)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          Фильтр по ученику
          <br />
          <select value={studentFilter} onChange={(event) => setStudentFilter(event.target.value)}>
            <option value="">Все ученики</option>
            {students.map((student) => (
              <option key={student.id} value={student.id}>
                {student.fio}
              </option>
            ))}
          </select>
        </label>
      </div>

      {!filteredRecords.length ? (
        <div>Записи посещаемости не найдены.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>ID</th>
              <th>Занятие</th>
              <th>Ученик</th>
              <th>Абонемент</th>
              <th>Статус</th>
              <th>Цена</th>
              <th>Списано</th>
              <th>Остаток</th>
              <th>Комментарий</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.id}</td>
                <td>{record.lesson_label || `#${record.lesson_id}`}</td>
                <td>{record.student_name || record.student_id || ''}</td>
                <td>{record.subscription_id ? `#${record.subscription_id}` : 'Без абонемента'}</td>
                <td>{STATUS_LABELS[record.status] || record.status || ''}</td>
                <td>{record.price_per_lesson ?? ''}</td>
                <td>{record.is_charged ? 'Да' : 'Нет'}</td>
                <td>{record.subscription_balance ?? ''}</td>
                <td>{record.comment || 'Комментарий не указан'}</td>
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
