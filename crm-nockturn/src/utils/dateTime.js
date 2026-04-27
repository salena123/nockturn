const pad = (value) => String(value).padStart(2, '0');

const formatDateParts = (date) =>
  `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`;

const formatTimeParts = (date, includeSeconds = true) => {
  const parts = [pad(date.getHours()), pad(date.getMinutes())];
  if (includeSeconds) {
    parts.push(pad(date.getSeconds()));
  }
  return parts.join(':');
};

export const formatServerDateTime = (value, { includeSeconds = true } = {}) => {
  if (!value) {
    return '—';
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim();
    const naiveMatch = normalizedValue.match(
      /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/
    );

    if (naiveMatch && !/[zZ]|[+-]\d{2}:\d{2}$/.test(normalizedValue)) {
      const [, year, month, day, hours, minutes, seconds = '00'] = naiveMatch;
      const utcDate = new Date(
        Date.UTC(
          Number(year),
          Number(month) - 1,
          Number(day),
          Number(hours),
          Number(minutes),
          Number(seconds)
        )
      );
      return `${formatDateParts(utcDate)} ${formatTimeParts(utcDate, includeSeconds)}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `${formatDateParts(date)} ${formatTimeParts(date, includeSeconds)}`;
};

export const formatServerDate = (value) => {
  if (!value) {
    return '—';
  }

  if (typeof value === 'string') {
    const naiveMatch = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (naiveMatch) {
      const [, year, month, day] = naiveMatch;
      return `${day}.${month}.${year}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return formatDateParts(date);
};
