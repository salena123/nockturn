import React, { useEffect, useState } from 'react';
import DeleteConfirm from '../components/DeleteConfirm';
import StudentForm from '../components/StudentForm';
import StudentTable from '../components/StudentTable';
import api from '../api';


const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingStudent, setEditingStudent] = useState(null);
  const [deletingStudent, setDeletingStudent] = useState(null);
  const [studentSubscriptions, setStudentSubscriptions] = useState([]);
  const [subscriptionsForStudent, setSubscriptionsForStudent] = useState(null);

  const loadStudents = async () => {
    try {
      const response = await api.get('/api/students');
      setStudents(response.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось загрузить учеников');
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      await loadStudents();
      setLoading(false);
    };

    load();
  }, []);

  const handleSave = async () => {
    setEditingStudent(null);
    await loadStudents();
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/api/students/${deletingStudent.id}`);
      setDeletingStudent(null);
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
        onEdit={setEditingStudent}
        onDelete={setDeletingStudent}
        onOpenSubscriptions={handleOpenSubscriptions}
      />

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
                    <td>{subscription.total_price ?? subscription.price ?? ''}</td>
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
