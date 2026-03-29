import React, { useEffect, useState } from "react";

function PricesList() {
    const [prices, setPrices] = useState([]);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function load() {
            try {
                const baseURL = process.env.REACT_APP_STRAPI_URL || 'http://localhost:1337';
                const response = await fetch(`${baseURL}/api/prices-lists?populate=*`);

                if (!response.ok) {
                    throw new Error('Ошибка загрузки цен');
                }

                const json = await response.json();
                const list = json.data || [];

                setPrices(list);

            } catch (e) {
                setError(e.message);
            }
        }

        load();
    }, []);

    if (error) return <div>{error}</div>;
    if (!prices.length) return <div>Нет цен</div>;

    return (
        <div className="pricesList">
            <h2>Наши цены</h2>
            <ul>
                {prices.map((price, index) => (
                    <li key={index}>
                        <span>{price.title}</span>
                        <p>{price.description}</p>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export default PricesList;