import React from "react";

const PublicSiteEditor = () => {

    return (
        <div>
            <h2>Редактировать публичный сайта</h2>
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