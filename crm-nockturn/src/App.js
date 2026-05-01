import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';

import api from './api';
import Layout from './components/Layout';
import Login from './components/Login';
import AttendancePage from './pages/AttendancePage';
import DiscountsPage from './pages/DiscountsPage';
import DisciplinesPage from './pages/DisciplinesPage';
import Home from './pages/Home';
import LessonsJournalPage from './pages/LessonsJournalPage';
import NotesPage from './pages/NotesPage';
import NotificationsPage from './pages/NotificationsPage';
import PaymentsPage from './pages/PaymentsPage';
import PublicSiteEditor from './pages/PublicSiteEditor';
import RoomsPage from './pages/RoomsPage';
import SchedulePage from './pages/SchedulePage';
import Students from './pages/Students';
import SubscriptionsPage from './pages/SubscriptionsPage';
import TariffsPage from './pages/TariffsPage';
import TeachersPage from './pages/TeachersPage';
import Users from './pages/Users';


function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setCurrentUser(null);
        return;
      }

      try {
        const response = await api.get('/api/me');
        setCurrentUser(response.data);
      } catch (error) {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setCurrentUser(null);
      }
    };

    fetchUser();
  }, [token]);

  const handleLogin = (nextToken, refreshToken) => {
    localStorage.setItem('token', nextToken);
    localStorage.setItem('refreshToken', refreshToken);
    setToken(nextToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setCurrentUser(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  if (!currentUser) {
    return <div>Загрузка пользователя...</div>;
  }

  return (
    <Router>
      <Layout currentUser={currentUser} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Home currentUser={currentUser} />} />
          <Route path="/students" element={<Students currentUser={currentUser} />} />
          <Route path="/users" element={<Users currentUser={currentUser} />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/subscriptions" element={<SubscriptionsPage currentUser={currentUser} />} />
          <Route path="/payments" element={<PaymentsPage currentUser={currentUser} />} />
          <Route path="/attendance" element={<AttendancePage currentUser={currentUser} />} />
          <Route path="/lessons-journal" element={<LessonsJournalPage currentUser={currentUser} />} />
          <Route path="/notes" element={<NotesPage currentUser={currentUser} />} />
          <Route path="/notifications" element={<NotificationsPage currentUser={currentUser} />} />
          <Route path="/schedule" element={<SchedulePage currentUser={currentUser} />} />
          <Route path="/tariffs" element={<TariffsPage currentUser={currentUser} />} />
          <Route path="/discounts" element={<DiscountsPage currentUser={currentUser} />} />
          <Route path="/disciplines" element={<DisciplinesPage currentUser={currentUser} />} />
          <Route path="/rooms" element={<RoomsPage currentUser={currentUser} />} />
          <Route path="/editor" element={<PublicSiteEditor />} />
        </Routes>
      </Layout>
    </Router>
  );
}


export default App;
