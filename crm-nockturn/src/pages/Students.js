import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get('http://localhost:8000/api/students', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        setStudents(response.data);
      } catch (error) {
        console.error('Ошибка загрузки студентов:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  return (
    <div className="students-page">
      <h2>Студенты</h2>
      <button className="add-button">Добавить студента</button>
      
      <div className="students-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>ФИО</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Родители</th>
            </tr>
          </thead>
          <tbody>
            {students.map(student => (
              <tr key={student.id}>
                <td>{student.id}</td>
                <td>{student.fio}</td>
                <td>{student.phone}</td>
                <td>{student.email}</td>
                <td>{student.has_parent ? 'Да' : 'Нет'}</td>
                <td>
                  <button className="edit-button">Редактировать</button>
                  <button className="delete-button">Удалить</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Students;
