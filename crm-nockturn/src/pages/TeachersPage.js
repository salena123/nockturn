import React, { useCallback, useEffect, useState } from 'react';
import api from '../api';
import useActionDialog from '../components/ui/useActionDialog';

const TeachersPage = () => {
  const [teachers, setTeachers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterActive, setFilterActive] = useState('all');
  const [showSchedule, setShowSchedule] = useState(false);
  const [selectedTeacherSchedule, setSelectedTeacherSchedule] = useState(null);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const { dialog, showError, showSuccess, showConfirm } = useActionDialog();

  const [formData, setFormData] = useState({
    user_id: '',
    bio: '',
    experience_years: '',
    specialization: '',
  });

  const fetchTeachers = useCallback(async () => {
    try {
      const response = await api.get('/api/teachers');
      setTeachers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки преподавателей:', error);
      await showError(error.response?.data?.detail || 'Не удалось загрузить преподавателей');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await api.get('/api/users?is_active=true');
      setUsers(response.data);
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
      await showError(error.response?.data?.detail || 'Не удалось загрузить пользователей');
    }
  }, [showError]);

  useEffect(() => {
    fetchTeachers();
    fetchUsers();
  }, [fetchTeachers, fetchUsers]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      if (editingTeacher) {
        await api.put(`/api/teachers/${editingTeacher.id}`, formData);
      } else {
        await api.post('/api/teachers', formData);
      }

      await fetchTeachers();
      await fetchUsers();
      await showSuccess(editingTeacher ? 'Преподаватель успешно обновлен.' : 'Преподаватель успешно создан.');
      resetForm();
    } catch (error) {
      console.error('Ошибка сохранения преподавателя:', error);
      await showError(error.response?.data?.detail || 'Ошибка сохранения');
    }
  };

  const handleEdit = (teacher) => {
    setEditingTeacher(teacher);
    setFormData({
      user_id: teacher.user_id,
      bio: teacher.bio || '',
      experience_years: teacher.experience_years || '',
      specialization: teacher.specialization || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (teacherId) => {
    const shouldDelete = await showConfirm(
      'Вы уверены, что хотите удалить преподавателя?',
      'Подтверждение удаления',
      'Удалить'
    );
    if (!shouldDelete) {
      return;
    }

    try {
      await api.delete(`/api/teachers/${teacherId}`);
      await fetchTeachers();
      await fetchUsers();
      await showSuccess('Преподаватель успешно удален.');
    } catch (error) {
      console.error('Ошибка удаления:', error);
      await showError(error.response?.data?.detail || 'Ошибка удаления');
    }
  };

  const resetForm = () => {
    setFormData({
      user_id: '',
      bio: '',
      experience_years: '',
      specialization: '',
    });
    setEditingTeacher(null);
    setShowModal(false);
  };

  const handleViewSchedule = async (teacher) => {
    setLoadingSchedule(true);
    setSelectedTeacherSchedule(teacher);
    setShowSchedule(true);

    try {
      const response = await api.get(`/api/teachers/${teacher.id}?include_schedule=true`);
      setSelectedTeacherSchedule(response.data);
    } catch (error) {
      console.error('Ошибка загрузки расписания:', error);
      await showError(error.response?.data?.detail || 'Не удалось загрузить расписание преподавателя');
    } finally {
      setLoadingSchedule(false);
    }
  };

  const filteredTeachers = teachers.filter((teacher) => {
    const matchesSearch =
      searchTerm === '' ||
      teacher.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.specialization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      teacher.user?.login?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesActive =
      filterActive === 'all' ||
      (filterActive === 'active' && teacher.user?.is_active) ||
      (filterActive === 'inactive' && !teacher.user?.is_active);

    return matchesSearch && matchesActive;
  });

  if (loading) {
    return <div>Загрузка преподавателей...</div>;
  }

  return (
    <div>
      <h2>Преподаватели</h2>

      <button type="button" onClick={() => setShowModal(true)}>
        Добавить преподавателя
      </button>

      <div>
        <input
          type="text"
          placeholder="Поиск по ФИО, специализации или логину..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
        />
        {' '}
        <select value={filterActive} onChange={(event) => setFilterActive(event.target.value)}>
          <option value="all">Все преподаватели</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
      </div>

      <div>
        <table border="1" cellPadding="6" cellSpacing="0">
          <thead>
            <tr>
              <th>ФИО</th>
              <th>Специализация</th>
              <th>Опыт (лет)</th>
              <th>Телефон</th>
              <th>Статус</th>
              <th>Дата найма</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher) => (
              <tr key={teacher.id}>
                <td>
                  <div>
                    <strong>{teacher.user?.full_name || 'N/A'}</strong>
                    <div>{teacher.user?.login}</div>
                  </div>
                </td>
                <td>{teacher.specialization || '—'}</td>
                <td>{teacher.experience_years || '—'}</td>
                <td>{teacher.user?.phone || '—'}</td>
                <td>{teacher.user?.is_active ? 'Активен' : 'Неактивен'}</td>
                <td>
                  {teacher.user?.hire_date ? new Date(teacher.user.hire_date).toLocaleDateString('ru-RU') : '—'}
                </td>
                <td>
                  <div>
                    <button type="button" onClick={() => handleViewSchedule(teacher)}>
                      Расписание
                    </button>{' '}
                    <button type="button" onClick={() => handleEdit(teacher)}>
                      Редактировать
                    </button>{' '}
                    <button type="button" onClick={() => handleDelete(teacher.id)}>
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
        ))}
      </tbody>
        </table>

        {filteredTeachers.length === 0 && (
          <div>
            {searchTerm || filterActive !== 'all' ? 'Преподаватели не найдены' : 'Нет преподавателей в системе'}
          </div>
        )}
      </div>

      {showModal && (
        <div>
          <div>
            <h3>{editingTeacher ? 'Редактировать преподавателя' : 'Добавить преподавателя'}</h3>

            <form onSubmit={handleSubmit}>
              {!editingTeacher && (
                <div>
                  <label>Пользователь:</label>
                  <select
                    value={formData.user_id}
                    onChange={(event) =>
                      setFormData({ ...formData, user_id: parseInt(event.target.value, 10) })
                    }
                    required
                  >
                    <option value="">Выберите пользователя</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.full_name} ({user.login})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label>Специализация:</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(event) => setFormData({ ...formData, specialization: event.target.value })}
                  placeholder="Например: фортепиано, гитара, вокал"
                />
              </div>

              <div>
                <label>Опыт работы (лет):</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={formData.experience_years}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      experience_years: parseInt(event.target.value, 10) || '',
                    })
                  }
                />
              </div>

              <div>
                <label>О себе:</label>
                <textarea
                  value={formData.bio}
                  onChange={(event) => setFormData({ ...formData, bio: event.target.value })}
                  placeholder="Краткая информация о преподавателе..."
                  rows={4}
                />
              </div>

              <div>
                <button type="button" onClick={resetForm}>
                  Отмена
                </button>{' '}
                <button type="submit">
                  {editingTeacher ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSchedule && selectedTeacherSchedule && (
        <div>
          <div>
            <div>
              <h3>Расписание: {selectedTeacherSchedule.user?.full_name}</h3>
              <button type="button" onClick={() => setShowSchedule(false)}>
                Закрыть
              </button>
            </div>

            {loadingSchedule ? (
              <div>Загрузка расписания...</div>
            ) : (
              <>
                <div>
                  <h4>Статистика</h4>
                  <div>
                    <div>
                      <strong>Всего занятий:</strong> {selectedTeacherSchedule.statistics?.total_lessons || 0}
                    </div>
                    <div>
                      <strong>Предстоящих занятий:</strong> {selectedTeacherSchedule.statistics?.upcoming_lessons_count || 0}
                    </div>
                  </div>
                </div>

                <div>
                  <h4>Предстоящие занятия (следующие 7 дней)</h4>
                  {selectedTeacherSchedule.upcoming_lessons && selectedTeacherSchedule.upcoming_lessons.length > 0 ? (
                    <table border="1" cellPadding="6" cellSpacing="0">
                      <thead>
                        <tr>
                          <th>Дата</th>
                          <th>Время</th>
                          <th>Дисциплина</th>
                          <th>Кабинет</th>
                          <th>Тип</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeacherSchedule.upcoming_lessons.map((lesson, index) => (
                          <tr key={index}>
                            <td>
                              {new Date(lesson.start_time).toLocaleDateString('ru-RU')}
                            </td>
                            <td>
                              {new Date(lesson.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} -
                              {new Date(lesson.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td>{lesson.discipline || '—'}</td>
                            <td>{lesson.room || '—'}</td>
                            <td>
                              {lesson.type === 'lesson'
                                ? 'Урок'
                                : lesson.type === 'event'
                                  ? 'Мероприятие'
                                  : 'Мастер-класс'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div>Предстоящих занятий нет</div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {dialog}
    </div>
  );
};

export default TeachersPage;
