import React from 'react';

import {
  EVENT_TYPE_OPTIONS,
  formatEventConflictLabel,
  formatLessonLabel,
  formatRecurringLabel,
  parseServerDateTime,
} from './calendarGridShared';


const EventDetailsModal = ({ event, onClose, onDelete, onOpenAttendance, onOpenHistory, onEdit }) => {
  const eventStart = parseServerDateTime(event.start_time);
  const canEdit = Boolean(eventStart && new Date() < eventStart);
  const canMarkAttendance = Boolean(
    event.lesson?.id &&
    event.lesson?.students?.length &&
    eventStart &&
    new Date() >= eventStart
  );

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '460px' }}>
        <h3>Занятие</h3>
        <p>{formatLessonLabel(event)}</p>
        <p>Тип: {EVENT_TYPE_OPTIONS.find((option) => option.value === event.type)?.label || event.type}</p>
        <p>Преподаватель: {event.teacher?.full_name || event.teacher?.specialization || '—'}</p>
        <p>Кабинет: {event.room?.name || '—'}</p>
        <p>Повторяемость: {formatRecurringLabel(event.recurring)}</p>
        {event.lesson?.students?.length > 0 && (
          <p>Ученики: {event.lesson.students.map((student) => student.name).join(', ')}</p>
        )}
        {event.has_conflict && (
          <div style={{ marginBottom: '12px', color: '#b71c1c' }}>
            {formatEventConflictLabel(event)}
          </div>
        )}
        {!canMarkAttendance && event.lesson?.id && (
          <p style={{ color: '#b71c1c' }}>Отметить посещаемость можно только после начала занятия.</p>
        )}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => onOpenHistory(event)}>
            История
          </button>
          <button type="button" onClick={() => onEdit(event)} disabled={!canEdit}>
            Редактировать
          </button>
          {event.lesson?.id && (
            <button type="button" onClick={() => onOpenAttendance(event)} disabled={!canMarkAttendance}>
              Отметить посещаемость
            </button>
          )}
          <button type="button" onClick={onClose}>Закрыть</button>
          <button type="button" onClick={() => onDelete(event.id)} style={{ backgroundColor: '#c62828', color: 'white', border: 'none', padding: '8px 16px' }}>
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};


export default EventDetailsModal;
