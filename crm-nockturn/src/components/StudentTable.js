import React from 'react';


const StudentTable = ({
  students,
  onEdit,
  onDelete,
  onView,
  onEditComment,
  onOpenNotes,
  onOpenSubscriptions,
  onOpenHistory,
  onOpenWaitlist,
  onExport,
}) => {
  if (!students.length) {
    return <div>Ученики не найдены.</div>;
  }

  return (
    <table border="1" cellPadding="6" cellSpacing="0">
      <thead>
        <tr>
          <th>№</th>
          <th>ФИО</th>
          <th>Возраст</th>
          <th>Телефон</th>
          <th>Статус</th>
          <th>Уровень подготовки</th>
          <th>Ответственное лицо</th>
          <th>Комментарий</th>
          <th>Действия</th>
        </tr>
      </thead>
      <tbody>
        {students.map((student, index) => (
          <tr key={student.id}>
            <td>{index + 1}</td>
            <td>{student.fio}</td>
            <td>{student.age ?? '—'}</td>
            <td>{student.phone || '—'}</td>
            <td>{student.status_label || student.status || '—'}</td>
            <td>{student.level_label || student.level || '—'}</td>
            <td>{student.parent_name || '—'}</td>
            <td>
              {student.comment?.trim() ? student.comment : 'Комментарий не указан'}{' '}
              <button type="button" onClick={() => onEditComment(student)}>
                Изменить
              </button>
            </td>
            <td>
              <button type="button" onClick={() => onView(student)}>
                Просмотр
              </button>{' '}
              <button type="button" onClick={() => onEdit(student)}>
                Редактировать
              </button>{' '}
              <button type="button" onClick={() => onOpenNotes(student)}>
                Заметки
              </button>{' '}
              <button type="button" onClick={() => onOpenSubscriptions(student)}>
                Абонементы
              </button>{' '}
              <button type="button" onClick={() => onOpenHistory(student)}>
                История
              </button>{' '}
              <button type="button" onClick={() => onOpenWaitlist(student)}>
                Лист ожидания
              </button>{' '}
              <button type="button" onClick={() => onExport(student)}>
                Экспорт
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
