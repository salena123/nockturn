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
      parent_name: 'Имя родителя',
      parent_telegram_id: 'Телеграм ID родителя',
      address: 'Адрес',
      level: 'Уровень',
      status: 'Статус',
      comment: 'Комментарий',
      first_contact_date: 'Дата первого контакта',
      birth_date: 'Дата рождения'
    };
    
    return Object.keys(students[0])
      .filter(key => key !== 'parent' && key !== 'parent_id')
      .map(key => ({
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
                {header.key === 'has_parent' ? (student[header.key] ? 'Да' : 'Нет') : 
               header.key === 'parent_telegram_id' ? (student.parent?.telegram_id || '') : 
               student[header.key]}
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
