import React from "react";
import api from '../api';
import { useEffect, useState } from "react";


const PublicSiteEditor = () => {
    const [currentUser, setCurrentUser] = useState(null);

    useEffect(() => {
    const init = async () => {
      try {
        const res = await api.get('/api/me');
        setCurrentUser(res.data);
      } catch (error) {
        console.error('Ошибка инициализации:', error);
      }
    };

    init();
    }, []);
  
    if (!currentUser) {
      return <div>Загрузка...</div>;
    }
    if (currentUser.role !== 'superadmin') {
      return <div>У вас нет доступа к этому разделу</div>;
    }

    return (
        <div>
            <h2>Redaktirovat' publichnyi sayta</h2>
            <a 
                href="http://localhost:1337/admin" 
                target="_blank" 
                rel="noopener noreferrer"
            >
            Перейти в редактор сайта
            </a>
            <p>Логин: example@ex.com</p>
            <p>Пароль: 12345678qQ</p>
        </div>
    );
};

export default PublicSiteEditor;