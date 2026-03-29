import './App.css';
import EventsList from './components/EventsList';
import PricesList from './components/PricesList';
import TeachersList from './components/TeachersList';

function App() {
  return (
    <div className="appRoot">
      <div className="appMain">Музыкальная студия "Ноктюрн"</div>
      <div className="eventsListContainer">
        <EventsList />
      </div>
      <TeachersList />
      <PricesList />
    </div>
  );
}

export default App;
