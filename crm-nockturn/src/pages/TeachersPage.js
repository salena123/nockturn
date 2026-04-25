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
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2>Преподаватели</h2>
        <button
          onClick={() => setShowModal(true)}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Добавить преподавателя
        </button>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '15px',
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
        }}
      >
        <input
          type="text"
          placeholder="Поиск по ФИО, специализации или логину..."
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          style={{
            flex: 1,
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        />

        <select
          value={filterActive}
          onChange={(event) => setFilterActive(event.target.value)}
          style={{
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
          }}
        >
          <option value="all">Все преподаватели</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            border: '1px solid #ddd',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f5f5f5' }}>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>ФИО</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Специализация</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Опыт (лет)</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Телефон</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Статус</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'left' }}>Дата найма</th>
              <th style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeachers.map((teacher) => (
              <tr key={teacher.id}>
                <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                  <div>
                    <strong>{teacher.user?.full_name || 'N/A'}</strong>
                    <div style={{ fontSize: '12px', color: '#666' }}>{teacher.user?.login}</div>
                  </div>
                </td>
                <td style={{ border: '1px solid #ddd', padding: '12px' }}>{teacher.specialization || '—'}</td>
                <td style={{ border: '1px solid #ddd', padding: '12px' }}>{teacher.experience_years || '—'}</td>
                <td style={{ border: '1px solid #ddd', padding: '12px' }}>{teacher.user?.phone || '—'}</td>
                <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                  <span
                    style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      backgroundColor: teacher.user?.is_active ? '#d4edda' : '#f8d7da',
                      color: teacher.user?.is_active ? '#155724' : '#721c24',
                    }}
                  >
                    {teacher.user?.is_active ? 'Активен' : 'Неактивен'}
                  </span>
                </td>
                <td style={{ border: '1px solid #ddd', padding: '12px' }}>
                  {teacher.user?.hire_date ? new Date(teacher.user.hire_date).toLocaleDateString('ru-RU') : '—'}
                </td>
                <td style={{ border: '1px solid #ddd', padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: '5px', justifyContent: 'center' }}>
                    <button
                      onClick={() => handleViewSchedule(teacher)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#17a2b8',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Расписание
                    </button>
                    <button
                      onClick={() => handleEdit(teacher)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Редактировать
                    </button>
                    <button
                      onClick={() => handleDelete(teacher.id)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredTeachers.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: '#666',
              backgroundColor: '#f9f9f9',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          >
            {searchTerm || filterActive !== 'all' ? 'Преподаватели не найдены' : 'Нет преподавателей в системе'}
          </div>
        )}
      </div>

      {showModal && (
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
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '500px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <h3>{editingTeacher ? 'Редактировать преподавателя' : 'Добавить преподавателя'}</h3>

            <form onSubmit={handleSubmit}>
              {!editingTeacher && (
                <div style={{ marginBottom: '15px' }}>
                  <label>Пользователь:</label>
                  <select
                    value={formData.user_id}
                    onChange={(event) =>
                      setFormData({ ...formData, user_id: parseInt(event.target.value, 10) })
                    }
                    required
                    style={{ width: '100%', padding: '8px', marginTop: '5px' }}
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

              <div style={{ marginBottom: '15px' }}>
                <label>Специализация:</label>
                <input
                  type="text"
                  value={formData.specialization}
                  onChange={(event) => setFormData({ ...formData, specialization: event.target.value })}
                  placeholder="Например: фортепиано, гитара, вокал"
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
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
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label>О себе:</label>
                <textarea
                  value={formData.bio}
                  onChange={(event) => setFormData({ ...formData, bio: event.target.value })}
                  placeholder="Краткая информация о преподавателе..."
                  rows={4}
                  style={{ width: '100%', padding: '8px', marginTop: '5px', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={resetForm} style={{ padding: '8px 16px' }}>
                  Отмена
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                  }}
                >
                  {editingTeacher ? 'Сохранить' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSchedule && selectedTeacherSchedule && (
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
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              padding: '20px',
              borderRadius: '8px',
              width: '800px',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3>Расписание: {selectedTeacherSchedule.user?.full_name}</h3>
              <button
                onClick={() => setShowSchedule(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                }}
              >
                Закрыть
              </button>
            </div>

            {loadingSchedule ? (
              <div>Загрузка расписания...</div>
            ) : (
              <>
                <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  <h4>Статистика</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
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
                    <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #ddd' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Дата</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Время</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Дисциплина</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Кабинет</th>
                          <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Тип</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedTeacherSchedule.upcoming_lessons.map((lesson, index) => (
                          <tr key={index}>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                              {new Date(lesson.start_time).toLocaleDateString('ru-RU')}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                              {new Date(lesson.start_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })} -
                              {new Date(lesson.end_time).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lesson.discipline || '—'}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>{lesson.room || '—'}</td>
                            <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '3px',
                                  fontSize: '11px',
                                  backgroundColor:
                                    lesson.type === 'lesson'
                                      ? '#d4edda'
                                      : lesson.type === 'event'
                                        ? '#d1ecf1'
                                        : '#fff3cd',
                                  color:
                                    lesson.type === 'lesson'
                                      ? '#155724'
                                      : lesson.type === 'event'
                                        ? '#0c5460'
                                        : '#856404',
                                }}
                              >
                                {lesson.type === 'lesson'
                                  ? 'Урок'
                                  : lesson.type === 'event'
                                    ? 'Мероприятие'
                                    : 'Мастер-класс'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div
                      style={{
                        textAlign: 'center',
                        padding: '20px',
                        color: '#666',
                        backgroundColor: '#f9f9f9',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                      }}
                    >
                      Предстоящих занятий нет
                    </div>
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
