import React, { useEffect, useState } from 'react';

function EventsList() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const baseURL = process.env.REACT_APP_STRAPI_URL || 'http://localhost:1337';
        const response = await fetch(`${baseURL}/api/event-lists?populate=*`);

        if (!response.ok) {
          throw new Error('Ошибка загрузки событий');
        }

        const json = await response.json();
        const list = json.data || [];

        setEvents(list);

      } catch (e) {
        setError(e.message);
      }
    }

    load();
  }, []);

  if (error) return <div>{error}</div>;
  if (!events.length) return <div>Нет событий</div>;

  return (
    <div className="eventsList">
      <h2>События</h2>
      <ul>
        {events.map((event, index) => (
          <li key={index}>
            <span>{event.title || `Событие ${index + 1}`}</span>
            {event.description && <div>{event.description}</div>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default EventsList;