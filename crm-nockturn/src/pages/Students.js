import React, { useState, useEffect } from 'react';
import api from '../api';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        const response = await api.get('/api/students');
        setStudents(response.data);
      } catch (error) {
        console.error('Ошибка загрузки учеников:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2>Ученики</h2>
      {students.map(student => (
        <div key={student.id}>
          {student.fio}
        </div>
      ))}
    </div>
  );
};

export default Students;