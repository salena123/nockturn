import React, { useEffect, useMemo, useState } from 'react';

import api from '../api';
import DeleteConfirm from '../components/DeleteConfirm';
import StudentForm from '../components/StudentForm';
import StudentTable from '../components/StudentTable';
import { formatServerDate, formatServerDateTime } from '../utils/dateTime';


const EMPTY_WAITLIST_FORM = {
  teacher_id: '',
  discipline_id: '',
  desired_schedule_text: '',
  comment: '',
  status: 'waiting',
};

const EMPTY_NOTE_FORM = {
  text: '',
};

const EMPTY_COMMENT_FORM = {
  comment: '',
};

const STUDENT_LEVEL_LABELS = {
  начальный: 'Начальный',
  средний: 'Средний',
  продвинутый: 'Продвинутый',
};

const STUDENT_STATUS_LABELS = {
  потенциальный: 'Потенциальный',
  активный: 'Активный',
  заморожен: 'Заморожен',
  отказался: 'Отказался',
};

const WAITLIST_STATUS_LABELS = {
  waiting: 'Ожидает',
  notified: 'Уведомлен',
  closed: 'Закрыт',
};

const SUBSCRIPTION_STATUS_LABELS = {
  active: 'Активен',
  frozen: 'Заморожен',
  expired: 'Завершен',
  closed: 'Закрыт',
  cancelled: 'Отменен',
  planned: 'Запланирован',
};

const ACTION_LABELS = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  restore: 'Восстановление',
};

const FIELD_LABELS = {
  fio: 'ФИО',
  phone: 'Телефон',
  email: 'Email',
  has_parent: 'Есть ответственное лицо',
  parent_id: 'Ответственное лицо',
  parent_name: 'ФИО ответственного лица',
  parent_phone: 'Телефон ответственного лица',
  parent_telegram_id: 'Telegram ID ответственного лица',
  address: 'Адрес проживания',
  level: 'Уровень подготовки',
  status: 'Статус',
  comment: 'Комментарий',
  first_contact_date: 'Дата первого обращения',
  birth_date: 'Дата рождения',
  student_id: 'Ученик',
  teacher_id: 'Преподаватель',
  discipline_id: 'Дисциплина',
  desired_schedule_text: 'Желаемое расписание',
  text: 'Текст заметки',
};

const getStudentLevelLabel = (level) =>
  STUDENT_LEVEL_LABELS[String(level || '').trim().toLowerCase()] || level || '—';

const getStudentStatusLabel = (status) =>
  STUDENT_STATUS_LABELS[String(status || '').trim().toLowerCase()] || status || '—';

const getWaitlistStatusLabel = (status) =>
  WAITLIST_STATUS_LABELS[String(status || '').trim().toLowerCase()] || status || '—';

const getSubscriptionStatusLabel = (status) =>
  SUBSCRIPTION_STATUS_LABELS[String(status || '').trim().toLowerCase()] || status || '—';

const getActionLabel = (action) => ACTION_LABELS[action] || action || '—';

const getFieldLabel = (fieldName) => FIELD_LABELS[fieldName] || fieldName || 'Данные';

const tryParseJson = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const downloadBlob = (blob, fileName) => {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const isCurrentSubscription = (subscription) => {
  const today = new Date().toISOString().slice(0, 10);
  const status = String(subscription?.status || '').trim().toLowerCase();
  const hasBalance = Number(subscription?.balance_lessons ?? 0) > 0;
  const started = !subscription?.start_date || subscription.start_date <= today;
  const notEnded = !subscription?.end_date || subscription.end_date >= today;

  if (status === 'active') {
    return true;
  }

  return started && notEnded && hasBalance;
};

const Students = ({ currentUser }) => {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [commentFilter, setCommentFilter] = useState('');
  const [sortOrder, setSortOrder] = useState('fio_asc');

  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [commentStudent, setCommentStudent] = useState(null);
  const [commentForm, setCommentForm] = useState(EMPTY_COMMENT_FORM);

  const [subscriptionsForStudent, setSubscriptionsForStudent] = useState(null);
  const [studentSubscriptions, setStudentSubscriptions] = useState([]);

  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);

  const [notesStudent, setNotesStudent] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesHistory, setNotesHistory] = useState([]);
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE_FORM);
  const [editingNoteId, setEditingNoteId] = useState(null);

  const [waitlistStudent, setWaitlistStudent] = useState(null);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [waitlistHistory, setWaitlistHistory] = useState([]);
  const [waitlistForm, setWaitlistForm] = useState(EMPTY_WAITLIST_FORM);
  const [editingWaitlistId, setEditingWaitlistId] = useState(null);

  const [allWaitlistOpen, setAllWaitlistOpen] = useState(false);
  const [allWaitlistEntries, setAllWaitlistEntries] = useState([]);

  const getTeacherName = (teacherId) => {
    if (!teacherId) {
      return '—';
    }

    const teacher = teachers.find((item) => item.id === Number(teacherId));
    return teacher?.user?.full_name || teacher?.specialization || `#${teacherId}`;
  };

  const getStudentName = (studentId) => {
    if (!studentId) {
      return '—';
    }

    const student = students.find((item) => item.id === Number(studentId));
    return student?.fio || `#${studentId}`;
  };

  const getDisciplineName = (disciplineId) => {
    if (!disciplineId) {
      return '—';
    }

    const discipline = disciplines.find((item) => item.id === Number(disciplineId));
    return discipline?.name || `#${disciplineId}`;
  };

  const formatHistoryValue = (value, fieldName, currentStudentName = null) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    const parsedValue = tryParseJson(value);

    if (typeof parsedValue === 'object' && parsedValue !== null && !Array.isArray(parsedValue)) {
      return Object.entries(parsedValue)
        .map(([key, nestedValue]) => `${getFieldLabel(key)}: ${formatHistoryValue(nestedValue, key, currentStudentName)}`)
        .join('; ');
    }

    if (fieldName === 'level') {
      return getStudentLevelLabel(parsedValue);
    }

    if (fieldName === 'status') {
      const studentStatus = getStudentStatusLabel(parsedValue);
      const waitlistStatus = getWaitlistStatusLabel(parsedValue);
      const subscriptionStatus = getSubscriptionStatusLabel(parsedValue);
      if (studentStatus !== parsedValue) return studentStatus;
      if (waitlistStatus !== parsedValue) return waitlistStatus;
      return subscriptionStatus;
    }

    if (fieldName === 'has_parent') {
      if (parsedValue === true || parsedValue === 'true') {
        return 'Да';
      }
      if (parsedValue === false || parsedValue === 'false') {
        return 'Нет';
      }
    }

    if (fieldName === 'teacher_id') {
      return getTeacherName(parsedValue);
    }

    if (fieldName === 'discipline_id') {
      return getDisciplineName(parsedValue);
    }

    if (fieldName === 'student_id') {
      return currentStudentName || getStudentName(parsedValue);
    }

    if (fieldName === 'birth_date' || fieldName === 'first_contact_date') {
      return formatServerDate(parsedValue);
    }

    if (typeof parsedValue === 'boolean') {
      return parsedValue ? 'Да' : 'Нет';
    }

    return String(parsedValue);
  };

  const loadStudents = async () => {
    const response = await api.get('/api/students');
    setStudents(response.data);
  };

  const loadReferenceData = async () => {
    const [teachersResponse, disciplinesResponse] = await Promise.all([
      api.get('/api/teachers'),
      api.get('/api/disciplines'),
    ]);
    setTeachers(teachersResponse.data);
    setDisciplines(disciplinesResponse.data);
  };

  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true);
        setError('');
        await Promise.all([loadStudents(), loadReferenceData()]);
      } catch (err) {
        setError(err.response?.data?.detail || 'Не удалось загрузить данные учеников');
      } finally {
        setLoading(false);
      }
    };

    loadAllData();
  }, []);

  const refreshAllWaitlist = async () => {
    if (!allWaitlistOpen) {
      return;
    }
    const response = await api.get('/api/waitlist');
    setAllWaitlistEntries(response.data);
  };

  const refreshWaitlist = async (studentId) => {
    const [entriesResponse, historyResponse] = await Promise.all([
      api.get(`/api/students/${studentId}/waitlist`),
      api.get(`/api/students/${studentId}/waitlist/history`),
    ]);
    setWaitlistEntries(entriesResponse.data);
    setWaitlistHistory(historyResponse.data);
  };

  const refreshNotes = async (studentId) => {
    const [notesResponse, historyResponse] = await Promise.all([
      api.get(`/api/students/${studentId}/notes`),
      api.get(`/api/students/${studentId}/notes/history`),
    ]);
    setNotes(notesResponse.data);
    setNotesHistory(historyResponse.data);
  };

  const handleSave = async () => {
    setEditingStudent(null);
    await loadStudents();
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/students/${deletingStudent.id}`);
      setDeletingStudent(null);

      if (historyStudent?.id === deletingStudent.id) {
        setHistoryStudent(null);
        setHistoryItems([]);
      }
      if (waitlistStudent?.id === deletingStudent.id) {
        setWaitlistStudent(null);
        setWaitlistEntries([]);
        setWaitlistHistory([]);
      }
      if (notesStudent?.id === deletingStudent.id) {
        setNotesStudent(null);
        setNotes([]);
        setNotesHistory([]);
      }
      if (viewingStudent?.id === deletingStudent.id) {
        setViewingStudent(null);
      }
      if (commentStudent?.id === deletingStudent.id) {
        setCommentStudent(null);
        setCommentForm(EMPTY_COMMENT_FORM);
      }
      if (subscriptionsForStudent?.id === deletingStudent.id) {
        setSubscriptionsForStudent(null);
        setStudentSubscriptions([]);
      }

      await loadStudents();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить ученика');
    }
  };

  const handleOpenSubscriptions = async (student) => {
    try {
      const response = await api.get(`/api/students/${student.id}/subscriptions`);
      setSubscriptionsForStudent(student);
      setStudentSubscriptions(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить абонементы ученика');
    }
  };

  const handleOpenHistory = async (student) => {
    try {
      const response = await api.get(`/api/students/${student.id}/history`);
      setHistoryStudent(student);
      setHistoryItems(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить историю ученика');
    }
  };

  const handleExportStudent = async (student) => {
    try {
      const response = await api.get(`/api/students/${student.id}/export/xlsx`, {
        responseType: 'blob',
      });
      downloadBlob(response.data, `student_${student.id}.xlsx`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось выгрузить карточку ученика');
    }
  };

  const handleOpenWaitlist = async (student) => {
    try {
      const [entriesResponse, historyResponse] = await Promise.all([
        api.get(`/api/students/${student.id}/waitlist`),
        api.get(`/api/students/${student.id}/waitlist/history`),
      ]);
      setWaitlistStudent(student);
      setWaitlistEntries(entriesResponse.data);
      setWaitlistHistory(historyResponse.data);
      setWaitlistForm(EMPTY_WAITLIST_FORM);
      setEditingWaitlistId(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить лист ожидания');
    }
  };

  const handleOpenAllWaitlist = async () => {
    try {
      const response = await api.get('/api/waitlist');
      setAllWaitlistEntries(response.data);
      setAllWaitlistOpen(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить общий лист ожидания');
    }
  };

  const handleOpenNotes = async (student) => {
    try {
      const [notesResponse, historyResponse] = await Promise.all([
        api.get(`/api/students/${student.id}/notes`),
        api.get(`/api/students/${student.id}/notes/history`),
      ]);
      setNotesStudent(student);
      setNotes(notesResponse.data);
      setNotesHistory(historyResponse.data);
      setNoteForm(EMPTY_NOTE_FORM);
      setEditingNoteId(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить заметки ученика');
    }
  };

  const handleOpenCommentEditor = (student) => {
    setCommentStudent(student);
    setCommentForm({ comment: student.comment || '' });
  };

  const handleWaitlistSubmit = async (event) => {
    event.preventDefault();
    if (!waitlistStudent) {
      return;
    }

    try {
      const payload = {
        student_id: waitlistStudent.id,
        teacher_id: waitlistForm.teacher_id ? Number(waitlistForm.teacher_id) : null,
        discipline_id: waitlistForm.discipline_id ? Number(waitlistForm.discipline_id) : null,
        desired_schedule_text: waitlistForm.desired_schedule_text || null,
        comment: waitlistForm.comment || null,
        status: waitlistForm.status || 'waiting',
      };

      if (editingWaitlistId) {
        await api.put(`/api/waitlist/${editingWaitlistId}`, payload);
      } else {
        await api.post('/api/waitlist', payload);
      }

      setWaitlistForm(EMPTY_WAITLIST_FORM);
      setEditingWaitlistId(null);
      await refreshWaitlist(waitlistStudent.id);
      await refreshAllWaitlist();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить запись листа ожидания');
    }
  };

  const handleWaitlistDelete = async (entryId) => {
    if (!waitlistStudent) {
      return;
    }

    try {
      await api.delete(`/api/waitlist/${entryId}`);
      await refreshWaitlist(waitlistStudent.id);
      await refreshAllWaitlist();
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить запись листа ожидания');
    }
  };

  const handleNoteSubmit = async (event) => {
    event.preventDefault();
    if (!notesStudent) {
      return;
    }

    try {
      const payload = { text: noteForm.text };
      if (editingNoteId) {
        await api.put(`/api/student-notes/${editingNoteId}`, payload);
      } else {
        await api.post(`/api/students/${notesStudent.id}/notes`, payload);
      }

      setNoteForm(EMPTY_NOTE_FORM);
      setEditingNoteId(null);
      await refreshNotes(notesStudent.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить заметку');
    }
  };

  const handleNoteDelete = async (noteId) => {
    if (!notesStudent) {
      return;
    }

    try {
      await api.delete(`/api/student-notes/${noteId}`);
      await refreshNotes(notesStudent.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить заметку');
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!commentStudent) {
      return;
    }

    try {
      const response = await api.put(`/api/students/${commentStudent.id}`, {
        comment: commentForm.comment || null,
      });
      setCommentStudent(null);
      setCommentForm(EMPTY_COMMENT_FORM);
      await loadStudents();
      if (viewingStudent?.id === commentStudent.id) {
        setViewingStudent(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить комментарий');
    }
  };

  const studentsForDisplay = students.map((student) => ({
    ...student,
    level_label: getStudentLevelLabel(student.level),
    status_label: getStudentStatusLabel(student.status),
  }));

  const filteredStudents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    const filtered = studentsForDisplay.filter((student) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          student.fio,
          student.phone,
          student.email,
          student.parent_name,
          student.comment,
          String(student.id),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));

      const matchesStatus = !statusFilter || student.status === statusFilter;
      const matchesLevel = !levelFilter || student.level === levelFilter;
      const matchesParent =
        !parentFilter ||
        (parentFilter === 'yes' && Boolean(student.has_parent)) ||
        (parentFilter === 'no' && !student.has_parent);
      const matchesComment =
        !commentFilter ||
        (commentFilter === 'with' && Boolean(student.comment?.trim())) ||
        (commentFilter === 'without' && !student.comment?.trim());

      return (
        matchesQuery &&
        matchesStatus &&
        matchesLevel &&
        matchesParent &&
        matchesComment
      );
    });

    return [...filtered].sort((left, right) => {
      const leftFio = String(left.fio || '').trim().toLowerCase();
      const rightFio = String(right.fio || '').trim().toLowerCase();

      if (sortOrder === 'fio_desc') {
        return rightFio.localeCompare(leftFio, 'ru');
      }

      return leftFio.localeCompare(rightFio, 'ru');
    });
  }, [
    studentsForDisplay,
    searchQuery,
    statusFilter,
    levelFilter,
    parentFilter,
    commentFilter,
    sortOrder,
  ]);

  if (loading) {
    return <div>Загрузка учеников...</div>;
  }

  const currentSubscriptions = studentSubscriptions.filter(isCurrentSubscription);
  const archivedSubscriptions = studentSubscriptions.filter(
    (subscription) => !isCurrentSubscription(subscription),
  );

  const renderSubscriptionTable = (items) => {
    if (!items.length) {
      return <div>Записей пока нет.</div>;
    }

    return (
      <table border="1" cellPadding="6" cellSpacing="0">
        <thead>
          <tr>
            <th>№</th>
            <th>Статус</th>
            <th>Тариф</th>
            <th>Всего занятий</th>
            <th>Остаток занятий</th>
            <th>Стоимость абонемента</th>
            <th>Дата начала</th>
            <th>Дата окончания</th>
          </tr>
        </thead>
        <tbody>
          {items.map((subscription, index ) => (
            <tr key={subscription.id}>
              <td>{index + 1}</td>
              <td>{getSubscriptionStatusLabel(subscription.status)}</td>
              <td>{subscription.tariff_id ? `#${subscription.tariff_id}` : '—'}</td>
              <td>{subscription.lessons_total ?? '—'}</td>
              <td>{subscription.balance_lessons ?? '—'}</td>
              <td>{subscription.total_price ?? '—'}</td>
              <td>{formatServerDate(subscription.start_date)}</td>
              <td>{formatServerDate(subscription.end_date)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div>
      <h2>Ученики</h2>

      {error && <div>{error}</div>}

      <button type="button" onClick={() => setEditingStudent({})}>
        Добавить ученика
      </button>{' '}
      <button type="button" onClick={handleOpenAllWaitlist}>
        Общий лист ожидания
      </button>

      <div style={{ marginTop: 16, marginBottom: 16, padding: 12, border: '1px solid #ccc' }}>
        <h3 style={{ marginTop: 0 }}>Поиск и фильтры</h3>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <label>
            Поиск
            <br />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="ФИО, телефон, email, ID, комментарий"
            />
          </label>

          <label>
            Статус
            <br />
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Все статусы</option>
              {Object.entries(STUDENT_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Уровень
            <br />
            <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)}>
              <option value="">Все уровни</option>
              {Object.entries(STUDENT_LEVEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Ответственное лицо
            <br />
            <select value={parentFilter} onChange={(event) => setParentFilter(event.target.value)}>
              <option value="">Все</option>
              <option value="yes">Есть</option>
              <option value="no">Нет</option>
            </select>
          </label>

          <label>
            Комментарий
            <br />
            <select value={commentFilter} onChange={(event) => setCommentFilter(event.target.value)}>
              <option value="">Все</option>
              <option value="with">Есть комментарий</option>
              <option value="without">Без комментария</option>
            </select>
          </label>

          <label>
            Сортировка
            <br />
            <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
              <option value="fio_asc">По алфавиту: А-Я</option>
              <option value="fio_desc">По алфавиту: Я-А</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('');
              setLevelFilter('');
              setParentFilter('');
              setCommentFilter('');
              setSortOrder('fio_asc');
            }}
          >
            Сбросить фильтры
          </button>
        </div>

        <div style={{ marginTop: 12 }}>
          Найдено учеников: {filteredStudents.length} из {studentsForDisplay.length}
        </div>
      </div>

      {editingStudent !== null && (
        <StudentForm
          student={editingStudent}
          onSave={handleSave}
          onCancel={() => setEditingStudent(null)}
          currentUser={currentUser}
        />
      )}

      <StudentTable
        students={filteredStudents}
        onView={setViewingStudent}
        onEditComment={handleOpenCommentEditor}
        onEdit={setEditingStudent}
        onDelete={setDeletingStudent}
        onOpenNotes={handleOpenNotes}
        onOpenSubscriptions={handleOpenSubscriptions}
        onOpenHistory={handleOpenHistory}
        onOpenWaitlist={handleOpenWaitlist}
        onExport={handleExportStudent}
      />

      {allWaitlistOpen && (
        <div>
          <h3>Общий лист ожидания</h3>
          {!allWaitlistEntries.length ? (
            <div>Записей в листе ожидания пока нет.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Ученик</th>
                  <th>Преподаватель</th>
                  <th>Дисциплина</th>
                  <th>Желаемое расписание</th>
                  <th>Комментарий</th>
                  <th>Статус</th>
                  <th>Дата создания</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {allWaitlistEntries.map((entry, index) => {
                  const student = students.find((item) => item.id === entry.student_id);
                  return (
                    <tr key={entry.id}>
                      <td>{index + 1}</td>
                      <td>{getStudentName(entry.student_id)}</td>
                      <td>{getTeacherName(entry.teacher_id)}</td>
                      <td>{getDisciplineName(entry.discipline_id)}</td>
                      <td>{entry.desired_schedule_text || '—'}</td>
                      <td>{entry.comment || '—'}</td>
                      <td>{getWaitlistStatusLabel(entry.status)}</td>
                      <td>{formatServerDateTime(entry.created_at)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            if (student) {
                              handleOpenWaitlist(student);
                            }
                          }}
                          disabled={!student}
                        >
                          Открыть ученика
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          <button type="button" onClick={() => setAllWaitlistOpen(false)}>
            Закрыть общий лист ожидания
          </button>
        </div>
      )}

      {viewingStudent && (
        <div>
          <h3>Карточка ученика: {viewingStudent.fio}</h3>
          <table border="1" cellPadding="6" cellSpacing="0">
            <tbody>
              <tr><td>ФИО</td><td>{viewingStudent.fio || '—'}</td></tr>
              <tr><td>Возраст</td><td>{viewingStudent.age ?? '—'}</td></tr>
              <tr><td>Дата рождения</td><td>{formatServerDate(viewingStudent.birth_date)}</td></tr>
              <tr><td>Телефон</td><td>{viewingStudent.phone || '—'}</td></tr>
              <tr><td>Email</td><td>{viewingStudent.email || '—'}</td></tr>
              <tr><td>Адрес</td><td>{viewingStudent.address || '—'}</td></tr>
              <tr><td>Уровень подготовки</td><td>{getStudentLevelLabel(viewingStudent.level)}</td></tr>
              <tr><td>Статус</td><td>{getStudentStatusLabel(viewingStudent.status)}</td></tr>
              <tr><td>Ответственное лицо</td><td>{viewingStudent.parent_name || '—'}</td></tr>
              <tr><td>Телефон ответственного лица</td><td>{viewingStudent.parent?.phone || '—'}</td></tr>
              <tr><td>Дата первого обращения</td><td>{formatServerDate(viewingStudent.first_contact_date)}</td></tr>
              <tr><td>Комментарий</td><td>{viewingStudent.comment || 'Комментарий не указан'}</td></tr>
            </tbody>
          </table>
          <button type="button" onClick={() => setViewingStudent(null)}>
            Закрыть просмотр
          </button>
        </div>
      )}

      {commentStudent && (
        <div>
          <h3>Комментарий ученика: {commentStudent.fio}</h3>
          <form onSubmit={handleCommentSubmit}>
            <div>
              <label>
                Комментарий
                <br />
                <textarea
                  rows="5"
                  value={commentForm.comment}
                  onChange={(event) => setCommentForm({ comment: event.target.value })}
                />
              </label>
            </div>
            <button type="submit">Сохранить комментарий</button>{' '}
            <button
              type="button"
              onClick={() => {
                setCommentStudent(null);
                setCommentForm(EMPTY_COMMENT_FORM);
              }}
            >
              Отмена
            </button>
          </form>
        </div>
      )}

      {notesStudent && (
        <div>
          <h3>Заметки ученика: {notesStudent.fio}</h3>

          <form onSubmit={handleNoteSubmit}>
            <div>
              <label>
                Текст заметки
                <br />
                <textarea
                  rows="4"
                  value={noteForm.text}
                  onChange={(event) => setNoteForm({ text: event.target.value })}
                  required
                />
              </label>
            </div>
            <button type="submit">
              {editingNoteId ? 'Сохранить заметку' : 'Добавить заметку'}
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                setNoteForm(EMPTY_NOTE_FORM);
                setEditingNoteId(null);
              }}
            >
              Сбросить
            </button>
          </form>

          {!notes.length ? (
            <div>Заметок пока нет.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Текст</th>
                  <th>Создано</th>
                  <th>Обновлено</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note, index) => (
                  <tr key={note.id}>
                    <td>{index + 1}</td>
                    <td>{note.text}</td>
                    <td>{formatServerDateTime(note.created_at)}</td>
                    <td>{formatServerDateTime(note.updated_at)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNoteId(note.id);
                          setNoteForm({ text: note.text || '' });
                        }}
                      >
                        Редактировать
                      </button>{' '}
                      <button type="button" onClick={() => handleNoteDelete(note.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>История заметок</h4>
          {!notesHistory.length ? (
            <div>История заметок пока пуста.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Кто изменил</th>
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {notesHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{formatServerDateTime(item.created_at)}</td>
                    <td>{item.actor_user_name || 'Система'}</td>
                    <td>{getActionLabel(item.action)}</td>
                    <td>{getFieldLabel(item.field_name)}</td>
                    <td>{formatHistoryValue(item.old_value, item.field_name, notesStudent.fio)}</td>
                    <td>{formatHistoryValue(item.new_value, item.field_name, notesStudent.fio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" onClick={() => setNotesStudent(null)}>
            Закрыть заметки
          </button>
        </div>
      )}

      {subscriptionsForStudent && (
        <div>
          <h3>Абонементы ученика: {subscriptionsForStudent.fio}</h3>
          {!studentSubscriptions.length ? (
            <div>Абонементы не найдены.</div>
          ) : (
            <>
              <h4>Текущие абонементы</h4>
              {renderSubscriptionTable(currentSubscriptions)}

              <h4>Архив абонементов</h4>
              {renderSubscriptionTable(archivedSubscriptions)}
            </>
          )}
          <button type="button" onClick={() => setSubscriptionsForStudent(null)}>
            Закрыть
          </button>
        </div>
      )}

      {historyStudent && (
        <div>
          <h3>История ученика: {historyStudent.fio}</h3>
          {!historyItems.length ? (
            <div>История изменений пока пуста.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Кто изменил</th>
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td>{formatServerDateTime(item.created_at)}</td>
                    <td>{item.actor_user_name || 'Система'}</td>
                    <td>{getActionLabel(item.action)}</td>
                    <td>{getFieldLabel(item.field_name)}</td>
                    <td>{formatHistoryValue(item.old_value, item.field_name, historyStudent.fio)}</td>
                    <td>{formatHistoryValue(item.new_value, item.field_name, historyStudent.fio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <button type="button" onClick={() => setHistoryStudent(null)}>
            Закрыть историю
          </button>
        </div>
      )}

      {waitlistStudent && (
        <div>
          <h3>Лист ожидания: {waitlistStudent.fio}</h3>

          <form onSubmit={handleWaitlistSubmit}>
            <div>
              <label>
                Преподаватель
                <br />
                <select
                  value={waitlistForm.teacher_id}
                  onChange={(event) =>
                    setWaitlistForm((prev) => ({ ...prev, teacher_id: event.target.value }))
                  }
                >
                  <option value="">Не выбран</option>
                  {teachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.user?.full_name || teacher.specialization || `#${teacher.id}`}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                Дисциплина
                <br />
                <select
                  value={waitlistForm.discipline_id}
                  onChange={(event) =>
                    setWaitlistForm((prev) => ({ ...prev, discipline_id: event.target.value }))
                  }
                >
                  <option value="">Не выбрана</option>
                  {disciplines.map((discipline) => (
                    <option key={discipline.id} value={discipline.id}>
                      {discipline.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <label>
                Желаемое расписание
                <br />
                <textarea
                  rows="3"
                  value={waitlistForm.desired_schedule_text}
                  onChange={(event) =>
                    setWaitlistForm((prev) => ({
                      ...prev,
                      desired_schedule_text: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <div>
              <label>
                Комментарий
                <br />
                <textarea
                  rows="3"
                  value={waitlistForm.comment}
                  onChange={(event) =>
                    setWaitlistForm((prev) => ({ ...prev, comment: event.target.value }))
                  }
                />
              </label>
            </div>

            <div>
              <label>
                Статус
                <br />
                <select
                  value={waitlistForm.status}
                  onChange={(event) =>
                    setWaitlistForm((prev) => ({ ...prev, status: event.target.value }))
                  }
                >
                  <option value="waiting">Ожидает</option>
                  <option value="notified">Уведомлен</option>
                  <option value="closed">Закрыт</option>
                </select>
              </label>
            </div>

            <button type="submit">
              {editingWaitlistId ? 'Сохранить запись' : 'Добавить в лист ожидания'}
            </button>{' '}
            <button
              type="button"
              onClick={() => {
                setWaitlistForm(EMPTY_WAITLIST_FORM);
                setEditingWaitlistId(null);
              }}
            >
              Сбросить
            </button>
          </form>

          {!waitlistEntries.length ? (
            <div>Лист ожидания пока пуст.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Преподаватель</th>
                  <th>Дисциплина</th>
                  <th>Желаемое расписание</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {waitlistEntries.map((entry, index) => (
                  <tr key={entry.id}>
                    <td>{index + 1}</td>
                    <td>{getTeacherName(entry.teacher_id)}</td>
                    <td>{getDisciplineName(entry.discipline_id)}</td>
                    <td>{entry.desired_schedule_text || '—'}</td>
                    <td>{getWaitlistStatusLabel(entry.status)}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWaitlistId(entry.id);
                          setWaitlistForm({
                            teacher_id: entry.teacher_id ? String(entry.teacher_id) : '',
                            discipline_id: entry.discipline_id ? String(entry.discipline_id) : '',
                            desired_schedule_text: entry.desired_schedule_text || '',
                            comment: entry.comment || '',
                            status: entry.status || 'waiting',
                          });
                        }}
                      >
                        Редактировать
                      </button>{' '}
                      <button type="button" onClick={() => handleWaitlistDelete(entry.id)}>
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h4>История листа ожидания</h4>
          {!waitlistHistory.length ? (
            <div>История пока пуста.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Кто изменил</th>
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {waitlistHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{formatServerDateTime(item.created_at)}</td>
                    <td>{item.actor_user_name || 'Система'}</td>
                    <td>{getActionLabel(item.action)}</td>
                    <td>{getFieldLabel(item.field_name)}</td>
                    <td>{formatHistoryValue(item.old_value, item.field_name, waitlistStudent.fio)}</td>
                    <td>{formatHistoryValue(item.new_value, item.field_name, waitlistStudent.fio)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <button type="button" onClick={() => setWaitlistStudent(null)}>
            Закрыть лист ожидания
          </button>
        </div>
      )}

      {deletingStudent && (
        <DeleteConfirm
          item={deletingStudent}
          itemType="student"
          onConfirm={handleDelete}
          onCancel={() => setDeletingStudent(null)}
        />
      )}
    </div>
  );
};


export default Students;
