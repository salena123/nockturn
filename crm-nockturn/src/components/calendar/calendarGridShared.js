import { formatServerDateTime } from '../../utils/dateTime';

export const SLOT_MINUTES = 15;
export const DAY_START_HOUR = 9;
export const DAY_END_HOUR = 23;
export const ROW_HEIGHT = 28;
export const TIME_COLUMN_WIDTH = 88;

export const VIEW_OPTIONS = [
  { value: 'day', label: 'День' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
];

export const EVENT_TYPE_OPTIONS = [
  { value: 'lesson', label: 'Урок' },
  { value: 'event', label: 'Мероприятие' },
  { value: 'masterclass', label: 'Мастер-класс' },
];

export const LESSON_TYPE_OPTIONS = [
  { value: 'individual', label: 'Индивидуальное' },
  { value: 'group', label: 'Групповое' },
];

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'Без повторения' },
  { value: 'daily', label: 'Каждый день' },
  { value: 'weekly', label: 'Каждую неделю' },
  { value: 'weekdays', label: 'По дням недели' },
];

export const ATTENDANCE_STATUS_OPTIONS = [
  { value: 'done', label: 'Пришел' },
  { value: 'miss_valid', label: 'Не пришел по уважительной причине' },
  { value: 'miss_invalid', label: 'Не пришел без уважительной причины' },
];

export const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Пн' },
  { value: 1, label: 'Вт' },
  { value: 2, label: 'Ср' },
  { value: 3, label: 'Чт' },
  { value: 4, label: 'Пт' },
  { value: 5, label: 'Сб' },
  { value: 6, label: 'Вс' },
];

export const HISTORY_ACTION_LABELS = {
  create: 'Создание',
  update: 'Изменение',
  delete: 'Удаление',
  move: 'Перенос',
};

export const HISTORY_FIELD_LABELS = {
  teacher_id: 'Преподаватель',
  discipline_id: 'Дисциплина',
  room_id: 'Кабинет',
  start_time: 'Начало',
  end_time: 'Окончание',
  type: 'Тип события',
  lesson_type: 'Формат занятия',
  max_students: 'Максимум учеников',
  student_ids: 'Ученики',
};

export const HISTORY_ENTITY_LABELS = {
  schedule_event: 'Расписание',
  lesson: 'Ученики',
};

export const pad = (value) => String(value).padStart(2, '0');

export const formatLocalDate = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const formatLocalMonth = (date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;

export const formatLocalDateTime = (date) =>
  `${formatLocalDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;

export const parseServerDateTime = (value) => {
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

export const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
};

export const startOfWeek = (date) => {
  const nextDate = new Date(date);
  const diff = nextDate.getDate() - nextDate.getDay() + (nextDate.getDay() === 0 ? -6 : 1);
  nextDate.setDate(diff);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

export const startOfMonth = (date) => {
  const nextDate = new Date(date);
  nextDate.setDate(1);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
};

export const getWeekDays = (date) => {
  const firstDay = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => addDays(firstDay, index));
};

export const getMonthGridDays = (date) => {
  const firstDay = startOfMonth(date);
  const gridStart = startOfWeek(firstDay);
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

export const getTimeSlots = () => {
  const slots = [];
  for (let hour = DAY_START_HOUR; hour <= DAY_END_HOUR; hour += 1) {
    for (let minute = 0; minute < 60; minute += SLOT_MINUTES) {
      slots.push(`${pad(hour)}:${pad(minute)}`);
    }
  }
  return slots;
};

export const getRangeLabel = (viewMode, currentDate) => {
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

export const getWeekdayLabel = (date) =>
  date.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

export const getEventColor = (event) => {
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

export const getEventDurationMinutes = (startTime, endTime) =>
  Math.max(SLOT_MINUTES, (endTime.getTime() - startTime.getTime()) / 60000);

export const formatApiError = (detail) => {
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

export const formatLessonLabel = (event) => {
  const start = parseServerDateTime(event.start_time);
  const end = parseServerDateTime(event.end_time);

  return `${event.discipline?.name || 'Без дисциплины'} • ${
    start ? start.toLocaleDateString('ru-RU') : ''
  } ${start ? start.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''}-${
    end ? end.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) : ''
  }`;
};

export const formatRecurringLabel = (recurring) => {
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

export const formatEventConflictLabel = (event) => {
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

export const formatHistoryValue = (fieldName, value) => {
  if (!value) {
    return '—';
  }

  if ((fieldName === 'start_time' || fieldName === 'end_time') && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return formatServerDateTime(value);
  }

  return value;
};

export const pickSubscriptionForLessonDate = (subscriptions, lessonDate) => {
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

export const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
};
