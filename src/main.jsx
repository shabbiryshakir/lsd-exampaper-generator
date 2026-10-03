import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import '@fontsource/noto-serif/latin-400.css'
import '@fontsource/noto-serif/latin-700.css'
import './index.css' /* <--- THIS LINE IS MANDATORY FOR THE UI TO SHOW */

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)