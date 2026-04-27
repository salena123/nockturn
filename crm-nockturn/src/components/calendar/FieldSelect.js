import React from 'react';


const FieldSelect = ({ label, value, onChange, options, required = false }) => (
  <div style={{ marginBottom: '15px' }}>
    <label>{label}:</label>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required={required}
      style={{ width: '100%', padding: '5px', marginTop: '5px' }}
    >
      {options.map((option) => (
        <option key={`${label}-${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </div>
);


export default FieldSelect;
