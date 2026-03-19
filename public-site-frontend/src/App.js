import './App.css';
import EventsList from './components/EventsList';

function App() {
  return (
    <div className="appRoot">
      <div className="appMain">Музыкальная студия "Ноктюрн"</div>
      <div className="eventsListContainer">
        <EventsList />
      </div>
    </div>
  );
}

export default App;
