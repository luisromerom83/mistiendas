import React from 'react';

const Loader = ({ show, imgSrc }) => {
  return (
    <div className={`loader-overlay ${!show ? 'hidden' : ''}`}>
      <div className="loader-content">
        {imgSrc ? <img src={imgSrc} alt="Store Logo" className="loader-logo" /> : <div style={{width: 50, height: 50, border: '4px solid #ef811e', borderRadius: '50%', marginBottom: '1rem'}} />}
        <div className="loader-spinner"></div>
      </div>
    </div>
  );
};

export default Loader;
