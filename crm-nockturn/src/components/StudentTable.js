import React from 'react';

const StudentTable = ({ students, onEdit, onDelete }) => {
  const getHeaders = () => {
    if (students.length === 0) return [];
    
    const fieldTranslations = {
      id: 'ID',
      fio: 'ФИО',
      phone: 'Телефон',
      email: 'Email',
      has_parent: 'Есть родитель',
      parent_id: 'ID родителя'
    };
    
    return Object.keys(students[0]).map(key => ({
      key,
      label: fieldTranslations[key] || key
    }));
  };

  const headers = getHeaders();

  return (
    <table border="1" cellPadding="8" cellSpacing="0">
      <thead>
        <tr>
          {headers.map(header => (
            <th key={header.key}>{header.label}</th>
          ))}
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {students.map(student => (
          <tr key={student.id}>
            {headers.map(header => (
              <td key={header.key}>
                {header.key === 'has_parent' ? (student[header.key] ? 'Да' : 'Нет') : student[header.key]}
              </td>
            ))}
            <td>
              <button onClick={() => onEdit(student)} className="btn btn-secondary mr-8">
                Редактировать
              </button>
              <button onClick={() => onDelete(student)} className="btn btn-danger mr-8">
                Удалить
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default StudentTable;
