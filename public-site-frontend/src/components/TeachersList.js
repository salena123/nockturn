import React, { useEffect, useState } from "react";

function TeachersList() {
    const [teachers, setTeachers] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const baseURL = process.env.REACT_APP_STRAPI_URL || 'http://localhost:1337';
                const response = await fetch(`${baseURL}/api/teachers-lists?populate=*`);

                if (!response.ok) {
                    throw new Error('Ошибка загрузки преподавателей');
                }

                const json = await response.json();
                const list = json.data || [];

                setTeachers(list);

            } catch (e) {
                setError(e.message);
            }
        }

        load();
    }, []);

    if (error) return <div>{error}</div>;
    if (!teachers.length) return <div>Нет преподавателей</div>;

    return (
        <div className="teachersList">
            <h2>Преподаватели</h2>
            <ul>
                {teachers.map((teacher, index) => (
                    <li key={index}>
                        <span>{teacher.name}</span>
                        <p>{teacher.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default TeachersList;