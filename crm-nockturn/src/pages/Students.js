import React, { useEffect, useState } from 'react';

import DeleteConfirm from '../components/DeleteConfirm';
import StudentForm from '../components/StudentForm';
import StudentTable from '../components/StudentTable';
import api from '../api';


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

const Students = () => {
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [viewingStudent, setViewingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [studentSubscriptions, setStudentSubscriptions] = useState([]);
  const [subscriptionsForStudent, setSubscriptionsForStudent] = useState(null);
  const [historyStudent, setHistoryStudent] = useState(null);
  const [historyItems, setHistoryItems] = useState([]);
  const [waitlistStudent, setWaitlistStudent] = useState(null);
  const [waitlistEntries, setWaitlistEntries] = useState([]);
  const [waitlistHistory, setWaitlistHistory] = useState([]);
  const [waitlistForm, setWaitlistForm] = useState(EMPTY_WAITLIST_FORM);
  const [editingWaitlistId, setEditingWaitlistId] = useState(null);
  const [notesStudent, setNotesStudent] = useState(null);
  const [notes, setNotes] = useState([]);
  const [notesHistory, setNotesHistory] = useState([]);
  const [noteForm, setNoteForm] = useState(EMPTY_NOTE_FORM);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [commentStudent, setCommentStudent] = useState(null);
  const [commentForm, setCommentForm] = useState(EMPTY_COMMENT_FORM);

  const loadStudents = async () => {
    try {
      const response = await api.get('/api/students');
      setStudents(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить учеников');
    }
  };

  const loadReferenceData = async () => {
    try {
      const [teachersResponse, disciplinesResponse] = await Promise.all([
        api.get('/api/teachers'),
        api.get('/api/disciplines'),
      ]);
      setTeachers(teachersResponse.data);
      setDisciplines(disciplinesResponse.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить справочники');
    }
  };

  const loadAllData = async () => {
    setLoading(true);
    setError('');
    await Promise.all([loadStudents(), loadReferenceData()]);
    setLoading(false);
  };

  useEffect(() => {
    loadAllData();
  }, []);

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
      setError(err.response?.data?.detail || 'Не удалось загрузить договоры ученика');
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
    setCommentForm({
      comment: student.comment || '',
    });
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

  const handleWaitlistSubmit = async (event) => {
    event.preventDefault();
    if (!waitlistStudent) return;

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
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить запись листа ожидания');
    }
  };

  const handleWaitlistDelete = async (entryId) => {
    if (!waitlistStudent) return;

    try {
      await api.delete(`/api/waitlist/${entryId}`);
      await refreshWaitlist(waitlistStudent.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить запись листа ожидания');
    }
  };

  const handleNoteSubmit = async (event) => {
    event.preventDefault();
    if (!notesStudent) return;

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
    if (!notesStudent) return;

    try {
      await api.delete(`/api/student-notes/${noteId}`);
      await refreshNotes(notesStudent.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось удалить заметку');
    }
  };

  const handleCommentSubmit = async (event) => {
    event.preventDefault();
    if (!commentStudent) return;

    try {
      await api.put(`/api/students/${commentStudent.id}`, {
        comment: commentForm.comment || null,
      });
      setCommentStudent(null);
      setCommentForm(EMPTY_COMMENT_FORM);
      await loadStudents();
      if (viewingStudent?.id === commentStudent.id) {
        const refreshedStudent = students.find((student) => student.id === commentStudent.id);
        if (refreshedStudent) {
          setViewingStudent({
            ...refreshedStudent,
            comment: commentForm.comment || null,
          });
        }
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить комментарий');
    }
  };

  if (loading) {
    return <div>Загрузка учеников...</div>;
  }

  return (
    <div>
      <h2>Ученики</h2>

      {error && <div>{error}</div>}

      <button type="button" onClick={() => setEditingStudent({})}>
        Добавить ученика
      </button>

      {editingStudent !== null && (
        <StudentForm
          student={editingStudent}
          onSave={handleSave}
          onCancel={() => setEditingStudent(null)}
        />
      )}

      <StudentTable
        students={students}
        onView={setViewingStudent}
        onEditComment={handleOpenCommentEditor}
        onEdit={setEditingStudent}
        onDelete={setDeletingStudent}
        onOpenNotes={handleOpenNotes}
        onOpenSubscriptions={handleOpenSubscriptions}
        onOpenHistory={handleOpenHistory}
        onOpenWaitlist={handleOpenWaitlist}
      />

      {viewingStudent && (
        <div>
          <h3>Карточка ученика: {viewingStudent.fio}</h3>
          <table border="1" cellPadding="6" cellSpacing="0">
            <tbody>
              <tr><td>ФИО</td><td>{viewingStudent.fio || ''}</td></tr>
              <tr><td>Возраст</td><td>{viewingStudent.age ?? ''}</td></tr>
              <tr><td>Дата рождения</td><td>{viewingStudent.birth_date || ''}</td></tr>
              <tr><td>Телефон</td><td>{viewingStudent.phone || ''}</td></tr>
              <tr><td>Email</td><td>{viewingStudent.email || ''}</td></tr>
              <tr><td>Адрес</td><td>{viewingStudent.address || ''}</td></tr>
              <tr><td>Уровень</td><td>{viewingStudent.level || ''}</td></tr>
              <tr><td>Статус</td><td>{viewingStudent.status || ''}</td></tr>
              <tr><td>Ответственный</td><td>{viewingStudent.parent_name || ''}</td></tr>
              <tr><td>Дата первого обращения</td><td>{viewingStudent.first_contact_date || ''}</td></tr>
              <tr><td>Комментарий</td><td>{viewingStudent.comment || ''}</td></tr>
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
                  <th>ID</th>
                  <th>Текст</th>
                  <th>Создано</th>
                  <th>Обновлено</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {notes.map((note) => (
                  <tr key={note.id}>
                    <td>{note.id}</td>
                    <td>{note.text}</td>
                    <td>{note.created_at || ''}</td>
                    <td>{note.updated_at || ''}</td>
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
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {notesHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at || ''}</td>
                    <td>{item.action || ''}</td>
                    <td>{item.field_name || ''}</td>
                    <td>{item.old_value || ''}</td>
                    <td>{item.new_value || ''}</td>
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
          <h3>Договоры ученика: {subscriptionsForStudent.fio}</h3>
          {!studentSubscriptions.length ? (
            <div>Договоры не найдены.</div>
          ) : (
            <table border="1" cellPadding="6" cellSpacing="0">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Статус</th>
                  <th>Тариф</th>
                  <th>Всего занятий</th>
                  <th>Остаток</th>
                  <th>Цена</th>
                  <th>Дата начала</th>
                  <th>Дата окончания</th>
                </tr>
              </thead>
              <tbody>
                {studentSubscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>{subscription.id}</td>
                    <td>{subscription.status || ''}</td>
                    <td>{subscription.tariff_id || ''}</td>
                    <td>{subscription.lessons_total ?? ''}</td>
                    <td>{subscription.balance_lessons ?? ''}</td>
                    <td>{subscription.total_price ?? ''}</td>
                    <td>{subscription.start_date || ''}</td>
                    <td>{subscription.end_date || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {historyItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at || ''}</td>
                    <td>{item.action || ''}</td>
                    <td>{item.field_name || ''}</td>
                    <td>{item.old_value || ''}</td>
                    <td>{item.new_value || ''}</td>
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
                  <option value="waiting">waiting</option>
                  <option value="notified">notified</option>
                  <option value="closed">closed</option>
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
                  <th>ID</th>
                  <th>Преподаватель</th>
                  <th>Дисциплина</th>
                  <th>Желаемое расписание</th>
                  <th>Статус</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {waitlistEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.id}</td>
                    <td>{teachers.find((teacher) => teacher.id === entry.teacher_id)?.user?.full_name || entry.teacher_id || ''}</td>
                    <td>{disciplines.find((discipline) => discipline.id === entry.discipline_id)?.name || entry.discipline_id || ''}</td>
                    <td>{entry.desired_schedule_text || ''}</td>
                    <td>{entry.status || ''}</td>
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
                  <th>Действие</th>
                  <th>Поле</th>
                  <th>Было</th>
                  <th>Стало</th>
                </tr>
              </thead>
              <tbody>
                {waitlistHistory.map((item) => (
                  <tr key={item.id}>
                    <td>{item.created_at || ''}</td>
                    <td>{item.action || ''}</td>
                    <td>{item.field_name || ''}</td>
                    <td>{item.old_value || ''}</td>
                    <td>{item.new_value || ''}</td>
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
