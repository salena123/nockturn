import React, { useState, useEffect } from 'react';
import api from '../api';
import StudentTable from '../components/StudentTable';
import StudentForm from '../components/StudentForm';
import DeleteConfirm from '../components/DeleteConfirm';

const Students = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingStudent, setDeletingStudent] = useState(null);

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

  const handleAddStudent = () => {
    setEditingStudent(null);
    setShowForm(true);
  };

  const handleEditStudent = (student) => {
    setEditingStudent(student);
    setShowForm(true);
  };

  const handleDeleteStudent = (student) => {
    setDeletingStudent(student);
    setShowDeleteConfirm(true);
  };

  const handleSaveStudent = () => {
    setShowForm(false);
    setEditingStudent(null);
    api.get('/api/students')
      .then(response => setStudents(response.data))
      .catch(error => console.error('Ошибка перезагрузки учеников:', error));
  };

  const handleCancelStudent = () => {
    setShowForm(false);
    setEditingStudent(null);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.delete(`/api/students/${deletingStudent.id}`);
      setStudents(students.filter(student => student.id !== deletingStudent.id));
      setShowDeleteConfirm(false);
      setDeletingStudent(null);
    } catch (error) {
      console.error('Ошибка удаления ученика:', error);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setDeletingStudent(null);
  };

  if (loading) return <div>Загрузка...</div>;

  return (
    <div>
      <h2>Ученики</h2>
      
      <button onClick={handleAddStudent} className="btn btn-primary mb-20">
        Добавить ученика
      </button>

      {showForm && (
        <StudentForm
          student={editingStudent}
          onSave={handleSaveStudent}
          onCancel={handleCancelStudent}
        />
      )}

      <StudentTable
        students={students}
        onEdit={handleEditStudent}
        onDelete={handleDeleteStudent}
      />

      {showDeleteConfirm && (
        <DeleteConfirm
          item={deletingStudent}
          itemType="student"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};

export default Students;