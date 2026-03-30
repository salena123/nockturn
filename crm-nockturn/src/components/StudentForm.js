import React, { useState, useEffect } from 'react';
import api from '../api';

const StudentForm = ({ student, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    fio: '',
    phone: '',
    email: '',
    has_parent: false,
    parent_id: ''
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (student) {
      setFormData({
        fio: student.fio,
        phone: student.phone,
        email: student.email,
        has_parent: student.has_parent || false,
        parent_id: student.parent_id || ''
      });
    }
  }, [student]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const submitData = {
        ...formData,
        parent_id: formData.has_parent && formData.parent_id ? parseInt(formData.parent_id) : null
      };

      if (student) {
        await api.put(`/api/students/${student.id}`, submitData);
      } else {
        await api.post('/api/students', submitData);
      }
      
      onSave();
    } catch (error) {
      console.error('Ошибка сохранения ученика:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h3>{student ? 'Редактировать ученика' : 'Добавить ученика'}</h3>
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>
            ФИО:
            <input
              type="text"
              name="fio"
              value={formData.fio}
              onChange={handleChange}
              required
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Телефон:
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            Email:
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="form-input"
            />
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="has_parent"
              checked={formData.has_parent}
              onChange={handleChange}
              className="form-checkbox"
            />
            Есть родитель
          </label>
        </div>

        {formData.has_parent && (
          <div className="form-group">
            <label>
              ID родителя:
              <input
                type="number"
                name="parent_id"
                value={formData.parent_id}
                onChange={handleChange}
                className="form-input"
              />
            </label>
          </div>
        )}

        <div>
          <button type="submit" disabled={loading} className="btn btn-primary mr-10">
            {loading ? 'Сохранение...' : 'Сохранить'}
          </button>
          <button type="button" onClick={onCancel} className="btn btn-secondary">
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};

export default StudentForm;
