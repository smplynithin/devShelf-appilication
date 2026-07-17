import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

// Find the div with id="root" in index.html
// Mount the entire React app inside it
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)