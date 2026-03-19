import React, { useEffect, useState } from 'react';

function EventsList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const baseUrl = process.env.REACT_APP_STRAPI_URL || 'http://localhost:1337';
        const res = await fetch(`${baseUrl}/api/event-lists?populate=event1`);

        if (!res.ok) {
          throw new Error(`Failed to load events: ${res.status} ${res.statusText}`);
        }

        const json = await res.json();

        const list = Array.isArray(json?.data) ? json.data : [];
        const flattened = list.flatMap((entry) => {
          const items = entry?.event1 ?? entry?.attributes?.event1;
          return Array.isArray(items) ? items : [];
        });

        if (!cancelled) {
          setEvents(flattened);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div>{error}</div>;
  if (events.length === 0) return null;

  return (
    <div className="eventsList">
      <div>События</div>
      <ul>
        {events.map((ev, idx) => {
          const title = ev?.title || `Event ${idx + 1}`;
          const description = ev?.description;

          return (
            <li key={`${title}-${idx}`}>
              <span>{title}</span>
              {description ? <div>{description}</div> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default EventsList;
