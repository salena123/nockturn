import React from 'react';

import {
  VIEW_OPTIONS,
  WEEKDAY_OPTIONS,
  formatLocalDate,
  formatLocalMonth,
  getRangeLabel,
  startOfMonth,
  startOfWeek,
} from './calendarGridShared';


const CalendarToolbar = ({
  currentDate,
  viewMode,
  teacherFilter,
  roomFilter,
  teachers,
  rooms,
  isTeacherUser,
  onNavigate,
  onCurrentDateChange,
  onViewModeChange,
  onTeacherFilterChange,
  onRoomFilterChange,
  onCreateLesson,
  onExport,
  nonWorkingPeriods,
}) => {
  const lunchBreaks = nonWorkingPeriods?.lunch_breaks || [];
  const weekends = new Set(nonWorkingPeriods?.weekends || []);

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Расписание</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={onCreateLesson}>
            Добавить занятие
          </button>
          <button type="button" onClick={() => onExport('xlsx')}>
            Экспорт .xlsx
          </button>
          <button type="button" onClick={() => onExport('ics')}>
            Экспорт .ics
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button type="button" onClick={() => onNavigate(-1)}>
          Назад
        </button>
        <div style={{ minWidth: '220px' }}>{getRangeLabel(viewMode, currentDate)}</div>
        <button type="button" onClick={() => onNavigate(1)}>
          Вперед
        </button>
        <button type="button" onClick={() => onCurrentDateChange(new Date())}>
          Сегодня
        </button>
        <button type="button" onClick={() => onCurrentDateChange(startOfWeek(new Date()))}>
          Эта неделя
        </button>
        <button type="button" onClick={() => onCurrentDateChange(startOfMonth(new Date()))}>
          Этот месяц
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Перейти к дате:</span>
          <input
            type="date"
            value={formatLocalDate(currentDate)}
            onChange={(event) => {
              const [year, month, day] = event.target.value.split('-').map(Number);
              if (!year || !month || !day) {
                return;
              }
              onCurrentDateChange(new Date(year, month - 1, day, 9, 0, 0));
            }}
          />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Выбрать месяц:</span>
          <input
            type="month"
            value={formatLocalMonth(currentDate)}
            onChange={(event) => {
              const [year, month] = event.target.value.split('-').map(Number);
              if (!year || !month) {
                return;
              }
              onCurrentDateChange(new Date(year, month - 1, 1, 9, 0, 0));
            }}
          />
        </label>
        <select value={viewMode} onChange={(event) => onViewModeChange(event.target.value)}>
          {VIEW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!isTeacherUser && (
          <select value={teacherFilter} onChange={(event) => onTeacherFilterChange(event.target.value)}>
            <option value="">Все преподаватели</option>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.user?.full_name || 'Без имени'}
              </option>
            ))}
          </select>
        )}
        <select value={roomFilter} onChange={(event) => onRoomFilterChange(event.target.value)}>
          <option value="">Все кабинеты</option>
          {rooms.map((room) => (
            <option key={room.id} value={room.id}>
              {room.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '16px', padding: '10px', border: '1px solid #ddd' }}>
        <div>Нерабочие периоды:</div>
        <div>Перерыв: {lunchBreaks.map((period) => `${period.start_time}-${period.end_time}`).join(', ') || 'не задан'}</div>
        <div>
          Выходные:{' '}
          {[...weekends]
            .map((dayIndex) => WEEKDAY_OPTIONS.find((item) => item.value === dayIndex)?.label)
            .filter(Boolean)
            .join(', ') || 'не заданы'}
        </div>
        <div>Праздничные дни: рабочий день начинается с {nonWorkingPeriods?.holiday_start_hour || 11}:00</div>
      </div>
    </>
  );
};


export default CalendarToolbar;
