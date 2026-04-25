import React from 'react';
import CalendarGrid from '../components/CalendarGrid';

const SchedulePage = ({ currentUser }) => {
  return (
    <div>
      <CalendarGrid currentUser={currentUser} />
    </div>
  );
};

export default SchedulePage;
