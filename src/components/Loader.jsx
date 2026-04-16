import React from 'react';

const Loader = ({ show }) => {
  return (
    <div className={`loader-overlay ${!show ? 'hidden' : ''}`}>
      <div className="loader-content">
        <img src="/logo.png" alt="DEPORTUX" className="loader-logo" />
        <div className="loader-spinner"></div>
      </div>
    </div>
  );
};

export default Loader;
