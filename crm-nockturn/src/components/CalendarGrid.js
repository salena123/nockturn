import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import ActionDialog from './ui/ActionDialog';

const SLOT_MINUTES = 15;
const DAY_START_HOUR = 9;
const DAY_END_HOUR = 23;
const ROW_HEIGHT = 28;
const TIME_COLUMN_WIDTH = 88;

const VIEW_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

const EVENT_TYPE_OPTIONS = [
  { value: 'lesson', label: 'Урок' },
  { value: 'event', label: 'Мероприятие' },
  { value: 'masterclass', label: 'Мастер-класс' },
];

const LESSON_TYPE_OPTIONS = [
  { value: 'individual', label: 'Индивидуальное' },
  { value: 'group', label: 'Групповое' },
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Без повторения' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'weekdays', label: 'По дням недели' },
];

const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'done', label: 'Пришел' },
  { value: 'miss_valid', label: 'Не пришел по уважительной причине' },
  { value: 'miss_invalid', label: 'Не пришел без уважительной причины' },
];

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Пн' },
  { value: 1, label: 'Вт' },
  { value: 2, label: 'Ср' },
  { value: 3, label: 'Чт' },
  { value: 4, label: 'Пт' },
  { value: 5, label: 'Сб' },
  { value: 6, label: 'Вс' },
];

const pad = (value) => String(value).padStart(2, '0');

const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const formatLocalMonth = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

const formatLocalDateTime = (date) =>
  `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

const parseServerDateTime = (value) => {
  if (!value) {
    return null;
  }

  const hasTimezone = value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value);
  if (hasTimezone) {
    return new Date(value);
  }

  const [datePart, timePart = '00:00:00'] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours = 0, minutes = 0, seconds = 0] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes, seconds);
};

const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

const startOfWeek = (date) => {
  const nextDate = new Date(date);
  const diff = nextDate.getDate() - nextDate.getDay() + (nextDate.getDay() === 0 ? -6 : 1);
  nextDate.setDate(diff);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const startOfMonth = (date) => {
  const nextDate = new Date(date);
  nextDate.setDate(1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

const getWeekDays = (date) => {
  const firstDay = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
};

const getMonthGridDays = (date) => {
  const firstDay = startOfMonth(date);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const getTimeSlots = () => {
  const slots = [];
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      slots.push(`${pad(hour)}:${pad(minute)}`);
    }
  }
  return slots;
};

const getRangeLabel = (viewMode, currentDate) => {
  if (viewMode === 'day') {
    return currentDate.toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  if (viewMode === 'month') {
    return currentDate.toLocaleDateString('ru-RU', {
      month: 'long',
      year: 'numeric',
    });
  }

  const weekDays = getWeekDays(currentDate);
  return `${weekDays[0].toLocaleDateString('ru-RU')} - ${weekDays[6].toLocaleDateString('ru-RU')}`;
};

const getWeekdayLabel = (date) =>
  date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

const getEventColor = (event) => {
  if (event.has_conflict) {
    return '#c62828';
  }
  if (event.type === 'masterclass') {
    return '#ef6c00';
  }
  if (event.type === 'event') {
    return '#1565c0';
  }
  return '#2e7d32';
};

const getEventDurationMinutes = (startTime, endTime) =>
  Math.max(SLOT_MINUTES, (endTime.getTime() - startTime.getTime()) / 60000);

const formatApiError = (detail) => {
  if (!detail) {
    return 'Ошибка сохранения';
  }

  if (typeof detail === 'string') {
    return detail;
  }

  const lines = [];
  if (detail.message) {
    lines.push(detail.message);
  }

  if (detail.teacher_conflicts?.length) {
    lines.push('');
    lines.push('Конфликт преподавателя:');
    detail.teacher_conflicts.forEach((conflict) => {
      lines.push(
        `- ${conflict.teacher_name || 'Преподаватель'} занят: ${conflict.time}` +
          `${conflict.discipline_name ? `, ${conflict.discipline_name}` : ''}` +
          `${conflict.room_name ? `, кабинет ${conflict.room_name}` : ''}`
      );
    });
  }

  if (detail.room_conflicts?.length) {
    lines.push('');
    lines.push('Конфликт кабинета:');
    detail.room_conflicts.forEach((conflict) => {
      lines.push(
        `- Кабинет ${conflict.room_name || conflict.room_id || ''} занят: ${conflict.time}` +
          `${conflict.teacher_name ? `, преподаватель ${conflict.teacher_name}` : ''}`
      );
    });
  }

  if (detail.student_conflicts?.length) {
    lines.push('');
    lines.push('Конфликт ученика:');
    detail.student_conflicts.forEach((conflict) => {
      lines.push(
        `- ${conflict.student_name || 'Ученик'} уже записан: ${conflict.time}` +
          `${conflict.discipline_name ? `, ${conflict.discipline_name}` : ''}`
      );
    });
  }

  return lines.join('\n').trim() || 'Ошибка сохранения';
};

const formatLessonLabel = (event) => {
  const start = parseServerDateTime(event.start_time);
  const end = parseServerDateTime(event.end_time);

  return `${event.discipline?.name || 'Без дисциплины'} • ${
    start ? start.toLocaleDateString('ru-RU') : ''
  } ${start ? start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}-${
    end ? end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
  }`;
};

const formatRecurringLabel = (recurring) => {
  if (!recurring?.repeat_type || recurring.repeat_type === 'none') {
    return 'Без повторения';
  }

  const repeatUntil = recurring.repeat_until
    ? new Date(recurring.repeat_until).toLocaleDateString('ru-RU')
    : 'без даты окончания';

  if (recurring.repeat_type === 'daily') {
    return `Каждый день до ${repeatUntil}`;
  }
  if (recurring.repeat_type === 'weekly') {
    return `Каждую неделю до ${repeatUntil}`;
  }
  return `По выбранным дням недели до ${repeatUntil}`;
};

const formatEventConflictLabel = (event) => {
  const teacherConflictCount = event?.conflicts?.teacher_conflicts?.length || 0;
  const roomConflictCount = event?.conflicts?.room_conflicts?.length || 0;

  if (teacherConflictCount && roomConflictCount) {
    return 'У занятия есть конфликт по преподавателю и кабинету.';
  }

  if (teacherConflictCount) {
    return 'У занятия есть конфликт по преподавателю.';
  }

  if (roomConflictCount) {
    return 'У занятия есть конфликт по кабинету.';
  }

  if (event?.has_conflict) {
    return 'У занятия есть конфликт.';
  }

  return '';
};

const pickSubscriptionForLessonDate = (subscriptions, lessonDate) => {
  if (!subscriptions?.length) {
    return null;
  }

  const candidates = lessonDate
    ? subscriptions.filter((subscription) => {
        const startsOk = !subscription.start_date || subscription.start_date <= lessonDate;
        const endsOk = !subscription.end_date || subscription.end_date >= lessonDate;
        return startsOk && endsOk;
      })
    : subscriptions;

  if (!candidates.length) {
    return null;
  }

  const sortByFreshness = (left, right) => {
    const leftStart = left.start_date || '';
    const rightStart = right.start_date || '';
    if (leftStart !== rightStart) {
      return rightStart.localeCompare(leftStart);
    }
    const leftCreated = left.created_at || '';
    const rightCreated = right.created_at || '';
    if (leftCreated !== rightCreated) {
      return rightCreated.localeCompare(leftCreated);
    }
    return (right.id || 0) - (left.id || 0);
  };

  const activeWithBalance = candidates
    .filter(
      (subscription) =>
        subscription.status === 'active' &&
        (subscription.balance_lessons === null || subscription.balance_lessons > 0)
    )
    .sort(sortByFreshness);
  if (activeWithBalance.length) {
    return activeWithBalance[0];
  }

  const activeCandidates = candidates
    .filter((subscription) => subscription.status === 'active')
    .sort(sortByFreshness);
  if (activeCandidates.length) {
    return activeCandidates[0];
  }

  const positiveBalanceCandidates = candidates
    .filter((subscription) => subscription.balance_lessons === null || subscription.balance_lessons > 0)
    .sort(sortByFreshness);
  if (positiveBalanceCandidates.length) {
    return positiveBalanceCandidates[0];
  }

  return [...candidates].sort(sortByFreshness)[0] || null;
};

const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};

const CalendarGrid = ({ currentUser }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [roomFilter, setRoomFilter] = useState('');
  const [events, setEvents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [students, setStudents] = useState([]);
  const [nonWorkingPeriods, setNonWorkingPeriods] = useState(null);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [editingEvent, setEditingEvent] = useState(null);
  const [attendanceEvent, setAttendanceEvent] = useState(null);
  const [historyEvent, setHistoryEvent] = useState(null);
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [draggedEvent, setDraggedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    tone: 'warning',
    confirmText: 'ОК',
    cancelText: 'Отмена',
    showCancel: false,
  });
  const dialogResolverRef = useRef(null);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const monthDays = useMemo(() => getMonthGridDays(currentDate), [currentDate]);
  const timeSlots = useMemo(() => getTimeSlots(), []);
  const visibleDays = viewMode === 'day' ? [currentDate] : weekDays;
  const isTeacherUser = currentUser?.role === 'teacher';
  const currentTeacher = useMemo(
    () => teachers.find((teacher) => teacher.user_id === currentUser?.id) || null,
    [teachers, currentUser]
  );

  const openDialog = useCallback((config) => new Promise((resolve) => {
    dialogResolverRef.current = resolve;
    setDialogState({
      isOpen: true,
      title: config.title,
      message: config.message,
      tone: config.tone || 'warning',
      confirmText: config.confirmText || 'ОК',
      cancelText: config.cancelText || 'Отмена',
      showCancel: Boolean(config.showCancel),
    });
  }), []);

  const showErrorDialog = useCallback(
    async (message, title = 'Ошибка') => {
      await openDialog({
        title,
        message,
        tone: 'error',
        confirmText: 'Понятно',
      });
    },
    [openDialog]
  );

  const showSuccessDialog = useCallback(
    async (message, title = 'Готово') => {
      await openDialog({
        title,
        message,
        tone: 'success',
        confirmText: 'ОК',
      });
    },
    [openDialog]
  );

  const showConfirmDialog = useCallback(
    (message, title = 'Подтверждение', confirmText = 'Подтвердить') =>
      openDialog({
        title,
        message,
        tone: 'warning',
        confirmText,
        cancelText: 'Отмена',
        showCancel: true,
      }),
    [openDialog]
  );

  const handleDialogConfirm = useCallback(() => {
    const resolve = dialogResolverRef.current;
    dialogResolverRef.current = null;
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) {
      resolve(true);
    }
  }, []);

  const handleDialogCancel = useCallback(() => {
    const resolve = dialogResolverRef.current;
    dialogResolverRef.current = null;
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolve) {
      resolve(false);
    }
  }, []);

  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const startDate =
        viewMode === 'day'
          ? formatLocalDate(currentDate)
          : viewMode === 'month'
            ? formatLocalDate(startOfMonth(currentDate))
            : formatLocalDate(weekDays[0]);

      const params = new URLSearchParams({
        start_date: startDate,
        view: viewMode,
      });
      if (teacherFilter) {
        params.append('teacher_id', teacherFilter);
      }
      if (roomFilter) {
        params.append('room_id', roomFilter);
      }

      const [eventsRes, teachersRes, disciplinesRes, roomsRes, studentsRes, periodsRes] = await Promise.all([
        api.get(`/api/schedule/calendar?${params.toString()}`),
        api.get('/api/teachers'),
        api.get('/api/disciplines'),
        api.get('/api/rooms'),
        api.get('/api/students'),
        api.get('/api/schedule/non-working-periods'),
      ]);

      setEvents(eventsRes.data || []);
      setTeachers(teachersRes.data || []);
      setDisciplines(disciplinesRes.data || []);
      setRooms(roomsRes.data || []);
      setStudents(studentsRes.data || []);
      setNonWorkingPeriods(periodsRes.data || null);
    } catch (error) {
      console.error('Ошибка загрузки календаря:', error);
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    } finally {
      setLoading(false);
    }
  }, [currentDate, showErrorDialog, teacherFilter, viewMode, weekDays, roomFilter]);

  useEffect(() => {
    fetchCalendarData();
  }, [fetchCalendarData]);

  const handleNavigate = (direction) => {
    setCurrentDate((prev) => {
      const nextDate = new Date(prev);
      if (viewMode === 'day') {
        nextDate.setDate(nextDate.getDate() + direction);
        return nextDate;
      }
      if (viewMode === 'month') {
        nextDate.setMonth(nextDate.getMonth() + direction);
        return nextDate;
      }
      nextDate.setDate(nextDate.getDate() + direction * 7);
      return nextDate;
    });
  };

  const handleCellClick = (date) => {
    setSelectedSlot({ date });
    setShowLessonModal(true);
  };

  const getEventsForDate = (date) =>
    events
      .map((event) => ({
        ...event,
        parsedStart: parseServerDateTime(event.start_time),
        parsedEnd: parseServerDateTime(event.end_time),
      }))
      .filter(
        (event) =>
          event.parsedStart &&
          event.parsedEnd &&
          event.parsedStart.toDateString() === date.toDateString()
      )
      .sort((left, right) => left.parsedStart - right.parsedStart);

  const getTimedEventsForDate = (date) => {
    const dayEvents = getEventsForDate(date);
    const clusters = [];
    const positionedEvents = [];
    let activeEvents = [];
    let currentCluster = null;

    dayEvents.forEach((event) => {
      activeEvents = activeEvents.filter((activeEvent) => activeEvent.parsedEnd > event.parsedStart);

      if (activeEvents.length === 0) {
        currentCluster = { id: clusters.length, laneCount: 0 };
        clusters.push(currentCluster);
      }

      const usedLanes = new Set(activeEvents.map((activeEvent) => activeEvent.laneIndex));
      let laneIndex = 0;
      while (usedLanes.has(laneIndex)) {
        laneIndex += 1;
      }

      const positionedEvent = { ...event, laneIndex, clusterId: currentCluster.id };
      currentCluster.laneCount = Math.max(currentCluster.laneCount, laneIndex + 1);
      activeEvents.push(positionedEvent);
      positionedEvents.push(positionedEvent);
    });

    return positionedEvents.map((event) => {
      const cluster = clusters[event.clusterId];
      return { ...event, laneCount: cluster?.laneCount || 1 };
    });
  };

  const handleHistoryOpen = async (event) => {
    setHistoryEvent(event);
    setHistoryLoading(true);
    try {
      const response = await api.get(`/api/schedule/history?event_id=${event.id}`);
      setHistoryRows(response.data || []);
    } catch (error) {
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
      setHistoryEvent(null);
    } finally {
      setHistoryLoading(false);
    }
  };

  const saveWithConflictHandling = async (requestFn, confirmationText) => {
    try {
      await requestFn(false);
      return true;
    } catch (error) {
      const detail = error.response?.data?.detail;
      if (error.response?.status === 409) {
        const shouldIgnore = await showConfirmDialog(
          `${formatApiError(detail)}\n\n${confirmationText}`,
          'Обнаружен конфликт',
          'Сохранить всё равно'
        );
        if (!shouldIgnore) {
          return false;
        }
        await requestFn(true);
        return true;
      }
      throw error;
    }
  };

  const handleMoveEvent = async (event, targetDate) => {
    const eventStart = parseServerDateTime(event.start_time);
    const eventEnd = parseServerDateTime(event.end_time);
    if (!eventStart || !eventEnd) {
      return;
    }

    const duration = eventEnd.getTime() - eventStart.getTime();
    const nextEnd = new Date(targetDate.getTime() + duration);

    try {
      const saved = await saveWithConflictHandling(
        (ignoreConflicts) =>
          api.put(`/api/schedule/events/${event.id}`, {
            start_time: formatLocalDateTime(targetDate),
            end_time: formatLocalDateTime(nextEnd),
            ignore_conflicts: ignoreConflicts,
          }),
        'Сохранить перенос несмотря на конфликты?'
      );

      if (saved) {
        await fetchCalendarData();
        await showSuccessDialog('Занятие успешно перенесено.');
      }
    } catch (error) {
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const handleExport = async (type) => {
    try {
      const startDate =
        viewMode === 'day'
          ? formatLocalDate(currentDate)
          : viewMode === 'month'
            ? formatLocalDate(startOfMonth(currentDate))
            : formatLocalDate(weekDays[0]);

      const params = new URLSearchParams({
        start_date: startDate,
        view: viewMode,
      });
      if (teacherFilter) {
        params.append('teacher_id', teacherFilter);
      }
      if (roomFilter) {
        params.append('room_id', roomFilter);
      }

      const response = await api.get(`/api/schedule/export/${type}?${params.toString()}`, {
        responseType: 'blob',
      });
      triggerDownload(response.data, `schedule.${type}`);
    } catch (error) {
      await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const lunchBreaks = nonWorkingPeriods?.lunch_breaks || [];
  const weekends = new Set(nonWorkingPeriods?.weekends || []);

  if (loading) {
    return <div>Загрузка расписания...</div>;
  }

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>Расписание</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => { setSelectedSlot(null); setShowLessonModal(true); }}>
            Добавить занятие
          </button>
          <button type="button" onClick={() => handleExport('xlsx')}>
            Экспорт .xlsx
          </button>
          <button type="button" onClick={() => handleExport('ics')}>
            Экспорт .ics
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <button type="button" onClick={() => handleNavigate(-1)}>
          Назад
        </button>
        <div style={{ minWidth: '220px' }}>{getRangeLabel(viewMode, currentDate)}</div>
        <button type="button" onClick={() => handleNavigate(1)}>
          Вперед
        </button>
        <button type="button" onClick={() => setCurrentDate(new Date())}>
          Сегодня
        </button>
        <button type="button" onClick={() => setCurrentDate(startOfWeek(new Date()))}>
          Эта неделя
        </button>
        <button type="button" onClick={() => setCurrentDate(startOfMonth(new Date()))}>
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
              setCurrentDate(new Date(year, month - 1, day, 9, 0, 0));
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
              setCurrentDate(new Date(year, month - 1, 1, 9, 0, 0));
            }}
          />
        </label>
        <select value={viewMode} onChange={(e) => setViewMode(e.target.value)}>
          {VIEW_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {!isTeacherUser && <select value={teacherFilter} onChange={(e) => setTeacherFilter(e.target.value)}>
          <option value="">Все преподаватели</option>
          {teachers.map((teacher) => (
            <option key={teacher.id} value={teacher.id}>
              {teacher.user?.full_name || 'Без имени'}
            </option>
          ))}
        </select>}
        <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)}>
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
        <div>Выходные: {[...weekends].map((dayIndex) => WEEKDAY_OPTIONS.find((item) => item.value === dayIndex)?.label).filter(Boolean).join(', ') || 'не заданы'}</div>
        <div>Праздничные дни: рабочий день начинается с {nonWorkingPeriods?.holiday_start_hour || 11}:00</div>
      </div>

      {viewMode === 'month' ? (
        <MonthView
          days={monthDays}
          currentDate={currentDate}
          getEventsForDate={getEventsForDate}
          onCellClick={handleCellClick}
          onEventClick={setSelectedEvent}
          weekends={weekends}
        />
      ) : (
        <TimedView
          days={visibleDays}
          viewMode={viewMode}
          timeSlots={timeSlots}
          getTimedEventsForDate={getTimedEventsForDate}
          onCellClick={handleCellClick}
          onEventClick={setSelectedEvent}
          onMoveEvent={handleMoveEvent}
          setDraggedEvent={setDraggedEvent}
          draggedEvent={draggedEvent}
          lunchBreaks={lunchBreaks}
          weekends={weekends}
        />
      )}

      {showLessonModal && (
        <LessonModal
          showModal={showLessonModal}
          onClose={() => {
            setShowLessonModal(false);
            setEditingEvent(null);
          }}
          selectedSlot={selectedSlot}
          editingEvent={editingEvent}
          teachers={teachers}
          disciplines={disciplines}
          rooms={rooms}
          students={students}
          onLessonCreated={fetchCalendarData}
          onConflictSave={saveWithConflictHandling}
          onShowError={showErrorDialog}
          onShowSuccess={showSuccessDialog}
          currentUser={currentUser}
          currentTeacher={currentTeacher}
        />
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={async (eventId) => {
            const shouldDelete = await showConfirmDialog(
              'Удалить это занятие из расписания?',
              'Подтверждение удаления',
              'Удалить'
            );
            if (!shouldDelete) {
              return;
            }
            try {
              await api.delete(`/api/schedule/events/${eventId}`);
              setSelectedEvent(null);
              await fetchCalendarData();
              await showSuccessDialog('Занятие удалено из расписания.');
            } catch (error) {
              await showErrorDialog(formatApiError(error.response?.data?.detail || error.response?.data?.message));
            }
          }}
          onOpenAttendance={(event) => {
            setSelectedEvent(null);
            setAttendanceEvent(event);
          }}
          onEdit={(event) => {
            setSelectedEvent(null);
            setSelectedSlot({ date: parseServerDateTime(event.start_time) || new Date() });
            setEditingEvent(event);
            setShowLessonModal(true);
          }}
          onOpenHistory={handleHistoryOpen}
        />
      )}

      {historyEvent && (
        <HistoryModal
          event={historyEvent}
          rows={historyRows}
          loading={historyLoading}
          onClose={() => setHistoryEvent(null)}
        />
      )}

      {attendanceEvent && (
        <AttendanceModal
          event={attendanceEvent}
          onClose={() => setAttendanceEvent(null)}
          onSaved={async () => {
            setAttendanceEvent(null);
            await fetchCalendarData();
            await showSuccessDialog('Посещаемость успешно сохранена.');
          }}
        />
      )}

      <ActionDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        tone={dialogState.tone}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        showCancel={dialogState.showCancel}
        onConfirm={handleDialogConfirm}
        onCancel={handleDialogCancel}
      />
    </div>
  );
};

const TimedView = ({
  days,
  viewMode,
  timeSlots,
  getTimedEventsForDate,
  onCellClick,
  onEventClick,
  onMoveEvent,
  setDraggedEvent,
  draggedEvent,
  lunchBreaks,
  weekends,
}) => {
  const getEventTop = (eventStart) => {
    const startOfDay = new Date(eventStart);
    startOfDay.setHours(DAY_START_HOUR, 0, 0, 0);
    const diffMinutes = Math.max(0, (eventStart.getTime() - startOfDay.getTime()) / 60000);
    return (diffMinutes / SLOT_MINUTES) * ROW_HEIGHT;
  };

  const getEventHeight = (eventStart, eventEnd) => {
    const durationMinutes = getEventDurationMinutes(eventStart, eventEnd);
    return (durationMinutes / SLOT_MINUTES) * ROW_HEIGHT;
  };

  const handleDrop = async (day, time, droppedEvent) => {
    if (!droppedEvent) {
      return;
    }
    const [hours, minutes] = time.split(':').map(Number);
    const nextDate = new Date(day);
    nextDate.setHours(hours, minutes, 0, 0);
    await onMoveEvent(droppedEvent, nextDate);
  };

  return (
    <div style={{ overflowX: 'auto', border: '1px solid #ddd' }}>
      <div style={{ display: 'flex', minWidth: viewMode === 'day' ? '520px' : '1200px' }}>
        <div style={{ width: `${TIME_COLUMN_WIDTH}px`, flexShrink: 0, borderRight: '1px solid #ddd' }}>
          <div style={{ height: '56px', borderBottom: '1px solid #ddd', backgroundColor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            Время
          </div>
          {timeSlots.map((time) => (
            <div
              key={time}
              style={{
                height: `${ROW_HEIGHT}px`,
                borderBottom: '1px solid #eee',
                padding: '4px',
                boxSizing: 'border-box',
                fontSize: '12px',
                backgroundColor: '#f9f9f9',
              }}
            >
              {time}
            </div>
          ))}
        </div>

        {days.map((day, index) => {
          const dayEvents = getTimedEventsForDate(day);
          const isWeekend = weekends.has(day.getDay() === 0 ? 6 : day.getDay() - 1);

          return (
            <div
              key={day.toISOString()}
              style={{
                flex: 1,
                minWidth: viewMode === 'day' ? '420px' : '150px',
                borderRight: index === days.length - 1 ? 'none' : '1px solid #ddd',
              }}
            >
              <div
                style={{
                  height: '56px',
                  borderBottom: '1px solid #ddd',
                  backgroundColor: isWeekend ? '#fff3e0' : '#f5f5f5',
                  padding: '10px',
                  boxSizing: 'border-box',
                }}
              >
                <div>{getWeekdayLabel(day)}</div>
              </div>

              <div style={{ position: 'relative', height: `${timeSlots.length * ROW_HEIGHT}px` }}>
                {lunchBreaks.map((period) => {
                  const [startHour, startMinute] = period.start_time.split(':').map(Number);
                  const [endHour, endMinute] = period.end_time.split(':').map(Number);
                  const top = ((startHour - DAY_START_HOUR) * 60 + startMinute) / SLOT_MINUTES * ROW_HEIGHT;
                  const height = (((endHour - startHour) * 60) + (endMinute - startMinute)) / SLOT_MINUTES * ROW_HEIGHT;
                  return (
                    <div
                      key={`${day.toISOString()}-${period.start_time}`}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundColor: 'rgba(255, 235, 59, 0.18)',
                        zIndex: 0,
                        pointerEvents: 'none',
                      }}
                    />
                  );
                })}

                {timeSlots.map((time, slotIndex) => (
                  <div
                    key={`${day.toISOString()}-${time}`}
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: `${slotIndex * ROW_HEIGHT}px`,
                      height: `${ROW_HEIGHT}px`,
                      borderBottom: '1px solid #eee',
                      boxSizing: 'border-box',
                      cursor: 'pointer',
                      backgroundColor: draggedEvent ? 'rgba(33, 150, 243, 0.02)' : 'transparent',
                    }}
                    onClick={() => onCellClick(new Date(`${formatLocalDate(day)}T${time}:00`))}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async (event) => {
                      event.preventDefault();
                      await handleDrop(day, time, draggedEvent);
                      setDraggedEvent(null);
                    }}
                  />
                ))}

                {dayEvents.map((event) => {
                  const top = getEventTop(event.parsedStart);
                  const height = getEventHeight(event.parsedStart, event.parsedEnd);
                  const widthPercent = 100 / event.laneCount;
                  const leftPercent = event.laneIndex * widthPercent;

                  return (
                    <div
                      key={event.id}
                      draggable
                      onDragStart={() => setDraggedEvent(event)}
                      onDragEnd={() => setDraggedEvent(null)}
                      style={{
                        position: 'absolute',
                        top: `${top}px`,
                        left: `calc(${leftPercent}% + 2px)`,
                        width: `calc(${widthPercent}% - 4px)`,
                        height: `${Math.max(height - 2, ROW_HEIGHT)}px`,
                        backgroundColor: getEventColor(event),
                        color: 'white',
                        borderRadius: '4px',
                        border: event.has_conflict ? '2px solid #ffebee' : 'none',
                        padding: '4px 6px',
                        boxSizing: 'border-box',
                        fontSize: '11px',
                        overflow: 'hidden',
                        zIndex: 2,
                        cursor: 'pointer',
                      }}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      <div><strong>{event.discipline?.name || 'Без дисциплины'}</strong></div>
                      <div>
                        {event.parsedStart.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        {' - '}
                        {event.parsedEnd.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div>{event.room?.name || '—'}</div>
                      {event.lesson?.students?.length > 0 && (
                        <div>{event.lesson.students.map((student) => student.name).join(', ')}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MonthView = ({ days, currentDate, getEventsForDate, onCellClick, onEventClick, weekends }) => {
  const monthNumber = currentDate.getMonth();

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
      {WEEKDAY_OPTIONS.map((weekday) => (
        <div key={weekday.value} style={{ fontWeight: 'bold', padding: '8px 0' }}>
          {weekday.label}
        </div>
      ))}

      {days.map((day) => {
        const dayEvents = getEventsForDate(day);
        const isCurrentMonth = day.getMonth() === monthNumber;
        const weekdayIndex = day.getDay() === 0 ? 6 : day.getDay() - 1;
        const isWeekend = weekends.has(weekdayIndex);

        return (
          <div
            key={day.toISOString()}
            style={{
              minHeight: '120px',
              border: '1px solid #ddd',
              padding: '8px',
              boxSizing: 'border-box',
              backgroundColor: isWeekend ? '#fff8e1' : isCurrentMonth ? 'white' : '#fafafa',
              cursor: 'pointer',
            }}
            onClick={() => onCellClick(new Date(`${formatLocalDate(day)}T09:00:00`))}
          >
            <div style={{ marginBottom: '8px', color: isCurrentMonth ? '#111' : '#9e9e9e' }}>
              {day.getDate()}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {dayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  style={{
                    textAlign: 'left',
                    border: 'none',
                    borderRadius: '4px',
                    backgroundColor: getEventColor(event),
                    color: 'white',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                  }}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    onEventClick(event);
                  }}
                >
                  {parseServerDateTime(event.start_time)?.toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  {event.discipline?.name || 'Занятие'}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

const LessonModal = ({
  showModal,
  onClose,
  selectedSlot,
  editingEvent,
  teachers,
  disciplines,
  rooms,
  students,
  onLessonCreated,
  onConflictSave,
  onShowError,
  onShowSuccess,
  currentUser,
  currentTeacher,
}) => {
  const initialDate = selectedSlot?.date || new Date();
  const isEditMode = Boolean(editingEvent?.id && editingEvent?.lesson?.id);
  const isTeacherUser = currentUser?.role === 'teacher';
  const [formData, setFormData] = useState({
    teacher_id: '',
    discipline_id: '',
    room_id: '',
    type: 'lesson',
    lesson_type: 'individual',
    max_students: 1,
    student_id: '',
    student_ids: [],
    duration: 45,
    recurrence_type: 'none',
    repeat_until: '',
    weekdays: [],
  });
  const [selectedDate, setSelectedDate] = useState(formatLocalDate(initialDate));
  const [selectedTime, setSelectedTime] = useState(`${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`);
  const [studentSearch, setStudentSearch] = useState('');
  const [showDisciplineCreate, setShowDisciplineCreate] = useState(false);
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const [newDisciplineName, setNewDisciplineName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  const [localDisciplines, setLocalDisciplines] = useState(disciplines);
  const [localRooms, setLocalRooms] = useState(rooms);

  const durations = useMemo(() => {
    const list = [];
    for (let minute = 30; minute <= 180; minute += 15) {
      list.push(minute);
    }
    return list;
  }, []);

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) {
      return students;
    }
    return students.filter(
      (student) =>
        student.fio?.toLowerCase().includes(query) ||
        student.phone?.toLowerCase().includes(query) ||
        student.email?.toLowerCase().includes(query)
    );
  }, [studentSearch, students]);

  useEffect(() => {
    setLocalDisciplines(disciplines);
  }, [disciplines]);

  useEffect(() => {
    setLocalRooms(rooms);
  }, [rooms]);

  useEffect(() => {
    const nextDate = selectedSlot?.date || new Date();
    setSelectedDate(formatLocalDate(nextDate));
    setSelectedTime(`${pad(nextDate.getHours())}:${pad(nextDate.getMinutes())}`);
  }, [selectedSlot, showModal]);

  useEffect(() => {
    if (!showModal) {
      return;
    }

    if (!isEditMode) {
      setFormData({
        teacher_id: isTeacherUser ? currentTeacher?.id || '' : '',
        discipline_id: '',
        room_id: '',
        type: 'lesson',
        lesson_type: 'individual',
        max_students: 1,
        student_id: '',
        student_ids: [],
        duration: 45,
        recurrence_type: 'none',
        repeat_until: '',
        weekdays: [],
      });
      return;
    }

    const startTime = parseServerDateTime(editingEvent.start_time);
    const endTime = parseServerDateTime(editingEvent.end_time);
    const duration = startTime && endTime
      ? Math.max(15, Math.round((endTime.getTime() - startTime.getTime()) / 60000))
      : 45;
    const studentIds = (editingEvent.lesson?.students || []).map((student) => student.id);

    setSelectedDate(startTime ? formatLocalDate(startTime) : formatLocalDate(new Date()));
    setSelectedTime(startTime ? `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}` : '09:00');
    setFormData({
      teacher_id: editingEvent.teacher_id || '',
      discipline_id: editingEvent.discipline_id || '',
      room_id: editingEvent.room_id || '',
      type: editingEvent.type || 'lesson',
      lesson_type: editingEvent.lesson?.lesson_type || 'individual',
      max_students: editingEvent.lesson?.max_students || 1,
      student_id:
        editingEvent.lesson?.lesson_type === 'individual' && studentIds.length
          ? studentIds[0]
          : '',
      student_ids: editingEvent.lesson?.lesson_type === 'group' ? studentIds : [],
      duration,
      recurrence_type: editingEvent.recurring?.repeat_type || 'none',
      repeat_until: editingEvent.recurring?.repeat_until || '',
      weekdays: [],
    });
  }, [currentTeacher, editingEvent, isEditMode, isTeacherUser, showModal]);

  const handleCreateDiscipline = async () => {
    const trimmedName = newDisciplineName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await api.post('/api/disciplines/', null, {
        params: { name: trimmedName },
      });
      setLocalDisciplines((prev) => [...prev, response.data]);
      setFormData((prev) => ({ ...prev, discipline_id: response.data.id }));
      setNewDisciplineName('');
      setShowDisciplineCreate(false);
    } catch (error) {
      await onShowError(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const handleCreateRoom = async () => {
    const trimmedName = newRoomName.trim();
    if (!trimmedName) {
      return;
    }

    try {
      const response = await api.post('/api/rooms/', null, {
        params: { name: trimmedName },
      });
      setLocalRooms((prev) => [...prev, response.data]);
      setFormData((prev) => ({ ...prev, room_id: response.data.id }));
      setNewRoomName('');
      setShowRoomCreate(false);
    } catch (error) {
      await onShowError(formatApiError(error.response?.data?.detail || error.response?.data?.message));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      if (isTeacherUser && !currentTeacher) {
        await onShowError('Не удалось определить преподавателя для текущего пользователя.');
        return;
      }

      const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
      const endTime = new Date(startTime);
      endTime.setMinutes(endTime.getMinutes() + formData.duration);
      const teacherId = isTeacherUser ? currentTeacher.id : Number(formData.teacher_id);

      const basePayload = {
        teacher_id: teacherId,
        discipline_id: Number(formData.discipline_id),
        room_id: Number(formData.room_id),
        start_time: formatLocalDateTime(startTime),
        end_time: formatLocalDateTime(endTime),
        type: formData.type,
        lesson_type: formData.lesson_type,
        max_students: Number(formData.max_students),
        student_ids:
          formData.lesson_type === 'group'
            ? formData.student_ids
            : formData.student_id
              ? [Number(formData.student_id)]
              : [],
        recurrence: {
          repeat_type: formData.recurrence_type,
          repeat_until: formData.recurrence_type === 'none' ? null : formData.repeat_until || null,
          weekdays: formData.recurrence_type === 'weekdays' ? formData.weekdays : [],
        },
      };

      const saved = await onConflictSave(
        (ignoreConflicts) => {
          if (isEditMode) {
            return api.put(`/api/schedule/events/${editingEvent.id}`, {
              teacher_id: basePayload.teacher_id,
              discipline_id: basePayload.discipline_id,
              room_id: basePayload.room_id,
              start_time: basePayload.start_time,
              end_time: basePayload.end_time,
              type: basePayload.type,
              ignore_conflicts: ignoreConflicts,
            });
          }

          return api.post('/api/schedule/entries', {
            ...basePayload,
            ignore_conflicts: ignoreConflicts,
          });
        },
        isEditMode
          ? 'Сохранить изменения несмотря на конфликты?'
          : 'Сохранить серию занятий несмотря на конфликты?'
      );

      if (saved) {
        if (isEditMode) {
          await api.put(`/api/schedule/lessons/${editingEvent.lesson.id}`, {
            lesson_type: basePayload.lesson_type,
            max_students: basePayload.max_students,
            student_ids: basePayload.student_ids,
          });
        }
        await onLessonCreated();
        await onShowSuccess(isEditMode ? 'Занятие успешно изменено.' : 'Занятие успешно создано.');
        onClose();
      }
    } catch (error) {
      await onShowError(
        formatApiError(
          error.response?.data?.detail ||
            error.response?.data?.message ||
            (isEditMode ? 'Не удалось изменить занятие' : 'Не удалось создать занятие')
        )
      );
    }
  };

  if (!showModal) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '640px', maxHeight: '84vh', overflowY: 'auto' }}>
        <h3>{isEditMode ? 'Редактирование занятия' : 'Создание занятия'}</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '15px' }}>
            <label>Дата:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label>Время начала:</label>
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              required
              style={{ width: '100%', padding: '5px', marginTop: '5px' }}
            />
          </div>

          {isTeacherUser && (
            <div style={{ marginBottom: '15px' }}>
              <label>Преподаватель:</label>
              <div
                style={{
                  width: '100%',
                  padding: '8px',
                  marginTop: '5px',
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                }}
              >
                {currentTeacher
                  ? `${currentTeacher.user?.full_name || 'Без имени'}${
                      currentTeacher.specialization ? ` (${currentTeacher.specialization})` : ''
                    }`
                  : 'Преподаватель не найден'}
              </div>
            </div>
          )}

          <FieldSelect
            label="Тип"
            value={formData.type}
            onChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
            options={EVENT_TYPE_OPTIONS}
          />

          <FieldSelect
            label="Формат занятия"
            value={formData.lesson_type}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                lesson_type: value,
                max_students: value === 'group' ? Math.max(prev.max_students, 2) : 1,
                student_id: '',
                student_ids: [],
              }))
            }
            options={LESSON_TYPE_OPTIONS}
          />

          {formData.lesson_type === 'individual' && (
            <FieldSelect
              label="Ученик"
              value={formData.student_id}
              onChange={(value) => setFormData((prev) => ({ ...prev, student_id: value ? Number(value) : '' }))}
              options={[
                { value: '', label: 'Выберите ученика' },
                ...students.map((student) => ({ value: student.id, label: student.fio })),
              ]}
              required
            />
          )}

          {formData.lesson_type === 'group' && (
            <>
              <div style={{ marginBottom: '15px' }}>
                <label>Количество учеников:</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={formData.max_students}
                  onChange={(e) => setFormData((prev) => ({ ...prev, max_students: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Поиск учеников:</label>
                <input
                  type="text"
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  placeholder="Введите ФИО, телефон или email"
                  style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                />
              </div>
              <div style={{ marginBottom: '15px' }}>
                <label>Ученики:</label>
                <div style={{ border: '1px solid #ccc', marginTop: '5px', padding: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {filteredStudents.map((student) => {
                    const checked = formData.student_ids.includes(student.id);
                    return (
                      <label key={student.id} style={{ display: 'block', marginBottom: '6px' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              student_ids: e.target.checked
                                ? [...prev.student_ids, student.id]
                                : prev.student_ids.filter((id) => id !== student.id),
                            }))
                          }
                        />{' '}
                        {student.fio}
                      </label>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {!isTeacherUser && <FieldSelect
            label="Преподаватель"
            value={formData.teacher_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, teacher_id: Number(value) }))}
            options={[
              { value: '', label: 'Выберите преподавателя' },
              ...teachers.map((teacher) => ({
                value: teacher.id,
                label: `${teacher.user?.full_name || 'Без имени'} (${teacher.specialization || '—'})`,
              })),
            ]}
            required
          />}

          <FieldSelect
            label="Дисциплина"
            value={formData.discipline_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, discipline_id: Number(value) }))}
            options={[
              { value: '', label: 'Выберите дисциплину' },
              ...localDisciplines.map((discipline) => ({ value: discipline.id, label: discipline.name })),
            ]}
            required
          />
          <button type="button" onClick={() => setShowDisciplineCreate((prev) => !prev)}>
            {showDisciplineCreate ? 'Отменить' : 'Добавить дисциплину'}
          </button>
          {showDisciplineCreate && (
            <div style={{ marginTop: '8px', marginBottom: '15px' }}>
              <input
                type="text"
                value={newDisciplineName}
                onChange={(e) => setNewDisciplineName(e.target.value)}
                placeholder="Название дисциплины"
                style={{ width: '100%', padding: '5px' }}
              />
              <button type="button" onClick={handleCreateDiscipline} style={{ marginTop: '5px' }}>
                Сохранить дисциплину
              </button>
            </div>
          )}

          <FieldSelect
            label="Кабинет"
            value={formData.room_id}
            onChange={(value) => setFormData((prev) => ({ ...prev, room_id: Number(value) }))}
            options={[
              { value: '', label: 'Выберите кабинет' },
              ...localRooms.map((room) => ({ value: room.id, label: room.name })),
            ]}
            required
          />
          <button type="button" onClick={() => setShowRoomCreate((prev) => !prev)}>
            {showRoomCreate ? 'Отменить' : 'Добавить кабинет'}
          </button>
          {showRoomCreate && (
            <div style={{ marginTop: '8px', marginBottom: '15px' }}>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Название кабинета"
                style={{ width: '100%', padding: '5px' }}
              />
              <button type="button" onClick={handleCreateRoom} style={{ marginTop: '5px' }}>
                Сохранить кабинет
              </button>
            </div>
          )}

          <FieldSelect
            label="Длительность"
            value={formData.duration}
            onChange={(value) => setFormData((prev) => ({ ...prev, duration: Number(value) }))}
            options={durations.map((duration) => ({ value: duration, label: `${duration} мин` }))}
          />

          {!isEditMode && (
            <>
              <FieldSelect
                label="Повторяемость"
                value={formData.recurrence_type}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    recurrence_type: value,
                    repeat_until: value === 'none' ? '' : prev.repeat_until || selectedDate,
                    weekdays: value === 'weekdays' ? (prev.weekdays.length ? prev.weekdays : [new Date(`${selectedDate}T00:00:00`).getDay() === 0 ? 6 : new Date(`${selectedDate}T00:00:00`).getDay() - 1]) : [],
                  }))
                }
                options={RECURRENCE_OPTIONS}
              />

              {formData.recurrence_type !== 'none' && (
                <div style={{ marginBottom: '15px' }}>
                  <label>Повторять до:</label>
                  <input
                    type="date"
                    value={formData.repeat_until}
                    min={selectedDate}
                    onChange={(e) => setFormData((prev) => ({ ...prev, repeat_until: e.target.value }))}
                    style={{ width: '100%', padding: '5px', marginTop: '5px' }}
                    required
                  />
                </div>
              )}

              {formData.recurrence_type === 'weekdays' && (
                <div style={{ marginBottom: '15px' }}>
                  <label>Дни недели:</label>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {WEEKDAY_OPTIONS.map((weekday) => (
                      <label key={weekday.value}>
                        <input
                          type="checkbox"
                          checked={formData.weekdays.includes(weekday.value)}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              weekdays: e.target.checked
                                ? [...prev.weekdays, weekday.value].sort((left, right) => left - right)
                                : prev.weekdays.filter((value) => value !== weekday.value),
                            }))
                          }
                        />{' '}
                        {weekday.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {isEditMode && editingEvent?.recurring?.repeat_type && editingEvent.recurring.repeat_type !== 'none' && (
            <div style={{ marginBottom: '15px', color: '#555' }}>
              Повторяемость серии здесь не меняется. Изменяется только выбранное занятие.
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose}>Отмена</button>
            <button type="submit" style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px' }}>
              {isEditMode ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const FieldSelect = ({ label, value, onChange, options, required = false }) => (
  <div style={{ marginBottom: '15px' }}>
    <label>{label}:</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      style={{ width: '100%', padding: '5px', marginTop: '5px' }}
    >
      {options.map((option) => (
        <option key={`${label}-${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);

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

const HistoryModal = ({ event, rows, loading, onClose }) => (
  <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1150 }}>
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '760px', maxHeight: '80vh', overflowY: 'auto' }}>
      <h3>История изменений</h3>
      <p>{formatLessonLabel(event)}</p>
      {loading ? (
        <div>Загрузка истории...</div>
      ) : rows.length === 0 ? (
        <div>Изменений пока нет.</div>
      ) : (
        <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginBottom: '16px' }}>
          <thead>
            <tr>
              <th>Когда</th>
              <th>Кто изменил</th>
              <th>Было</th>
              <th>Стало</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.changed_at ? new Date(row.changed_at).toLocaleString('ru-RU') : '—'}</td>
                <td>{row.changed_by?.full_name || row.changed_by?.login || '—'}</td>
                <td>{row.old_start ? new Date(row.old_start).toLocaleString('ru-RU') : '—'}</td>
                <td>{row.new_start ? new Date(row.new_start).toLocaleString('ru-RU') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  </div>
);

const AttendanceModal = ({ event, onClose, onSaved }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const eventStart = parseServerDateTime(event.start_time);
  const canMarkAttendance = Boolean(eventStart && new Date() >= eventStart);

  useEffect(() => {
    const loadAttendance = async () => {
      setLoading(true);
      setError('');

      try {
        const [response, subscriptionsResponses] = await Promise.all([
          api.get(`/api/attendance?lesson_id=${event.lesson.id}`),
          Promise.all(
            (event.lesson.students || []).map((student) =>
              api.get(`/api/students/${student.id}/subscriptions`)
            )
          ),
        ]);

        const recordsByStudentId = {};
        (response.data || []).forEach((record) => {
          recordsByStudentId[record.student_id] = record;
        });

        const subscriptionsByStudentId = {};
        (event.lesson.students || []).forEach((student, index) => {
          subscriptionsByStudentId[student.id] = subscriptionsResponses[index]?.data || [];
        });

        setRows(
          (event.lesson.students || []).map((student) => {
            const existing = recordsByStudentId[student.id];
            const matchingSubscription = pickSubscriptionForLessonDate(
              subscriptionsByStudentId[student.id],
              event.lesson.lesson_date
            );
            const hasMatchingSubscription = Boolean(matchingSubscription);
            const canCharge =
              hasMatchingSubscription &&
              matchingSubscription.price_per_lesson !== null &&
              matchingSubscription.price_per_lesson !== undefined;

            return {
              student_id: student.id,
              student_name: student.name,
              attendance_id: existing?.id || null,
              status: existing?.status || (canCharge ? 'done' : 'miss_valid'),
              comment: existing?.comment || '',
              subscription_id: hasMatchingSubscription ? matchingSubscription.id : null,
              subscription_price_per_lesson: hasMatchingSubscription
                ? matchingSubscription.price_per_lesson
                : null,
              subscription_balance_lessons: hasMatchingSubscription
                ? matchingSubscription.balance_lessons
                : null,
              can_charge: canCharge,
              charge_block_reason: hasMatchingSubscription
                ? (canCharge ? '' : 'В абонементе не указана стоимость занятия')
                : 'На дату урока нет подходящего абонемента',
            };
          })
        );
      } catch (loadError) {
        setError(formatApiError(loadError.response?.data?.detail || loadError.response?.data?.message));
      } finally {
        setLoading(false);
      }
    };

    loadAttendance();
  }, [event]);

  const handleChange = (studentId, field, value) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== studentId) {
          return row;
        }

        if (
          field === 'status' &&
          !row.can_charge &&
          (value === 'done' || value === 'miss_invalid')
        ) {
          return { ...row, status: 'miss_valid' };
        }

        return { ...row, [field]: value };
      })
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const blockedRows = rows.filter(
        (row) => !row.can_charge && (row.status === 'done' || row.status === 'miss_invalid')
      );

      if (blockedRows.length) {
        setError(
          blockedRows
            .map((row) => `${row.student_name}: ${row.charge_block_reason}`)
            .join('\n')
        );
        setSaving(false);
        return;
      }

      await Promise.all(
        rows.map((row) => {
          const payload = {
            lesson_id: event.lesson.id,
            student_id: row.student_id,
            status: row.status,
            comment: row.comment || null,
          };

          if (row.attendance_id) {
            return api.put(`/api/attendance/${row.attendance_id}`, payload);
          }

          return api.post('/api/attendance', payload);
        })
      );

      await onSaved();
    } catch (saveError) {
      setError(formatApiError(saveError.response?.data?.detail || saveError.response?.data?.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200 }}>
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '760px', maxHeight: '85vh', overflowY: 'auto' }}>
        <h3>Отметка посещаемости</h3>
        <p>{formatLessonLabel(event)}</p>
        {error && <div style={{ marginBottom: '12px', color: '#b71c1c', whiteSpace: 'pre-line' }}>{typeof error === 'string' ? error : JSON.stringify(error)}</div>}

        {loading ? (
          <div>Загрузка данных...</div>
        ) : !rows.length ? (
          <div>У этого урока нет привязанных учеников.</div>
        ) : (
          <table border="1" cellPadding="6" cellSpacing="0" style={{ width: '100%', marginBottom: '16px' }}>
            <thead>
              <tr>
                <th>Ученик</th>
                <th>Статус</th>
                <th>Абонемент</th>
                <th>Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.student_id}>
                  <td>{row.student_name}</td>
                  <td>
                    <select
                      value={row.status}
                      onChange={(e) => handleChange(row.student_id, 'status', e.target.value)}
                      disabled={!canMarkAttendance || saving}
                    >
                      {ATTENDANCE_STATUS_OPTIONS.map((option) => (
                        <option
                          key={`${row.student_id}-${option.value}`}
                          value={option.value}
                          disabled={!row.can_charge && (option.value === 'done' || option.value === 'miss_invalid')}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {row.subscription_id ? (
                      <div>
                        <div>#{row.subscription_id}</div>
                        <div>Цена: {row.subscription_price_per_lesson ?? 'не указана'}</div>
                        <div>Остаток: {row.subscription_balance_lessons ?? 'не указан'}</div>
                      </div>
                    ) : (
                      <div style={{ color: '#b71c1c' }}>{row.charge_block_reason}</div>
                    )}
                  </td>
                  <td>
                    <textarea
                      rows="2"
                      value={row.comment}
                      onChange={(e) => handleChange(row.student_id, 'comment', e.target.value)}
                      disabled={!canMarkAttendance || saving}
                      style={{ width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} disabled={saving}>Отмена</button>
          <button type="button" onClick={handleSave} disabled={saving || loading || !rows.length || !canMarkAttendance}>
            {saving ? 'Сохранение...' : 'Сохранить посещаемость'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;
