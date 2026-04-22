import React from 'react';


const StudentTable = ({ students, onEdit, onDelete, onOpenSubscriptions }) => {
  if (!students.length) {
    return <div>Клиенты не найдены.</div>;
  }

  return (
    <table border="1" cellPadding="6" cellSpacing="0">
      <thead>
        <tr>
          <th>ID</th>
          <th>ФИО</th>
          <th>Возраст</th>
          <th>Телефон</th>
          <th>Статус</th>
          <th>Уровень</th>
          <th>Ответственный</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student) => (
          <tr key={student.id}>
            <td>{student.id}</td>
            <td>{student.fio}</td>
            <td>{student.age ?? ''}</td>
            <td>{student.phone || ''}</td>
            <td>{student.status || ''}</td>
            <td>{student.level || ''}</td>
            <td>{student.parent_name || ''}</td>
            <td>
              <button type="button" onClick={() => onEdit(student)}>
                Редактировать
              </button>{' '}
              <button type="button" onClick={() => onOpenSubscriptions(student)}>
                Договоры
              </button>{' '}
              <button type="button" onClick={() => onDelete(student)}>
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
