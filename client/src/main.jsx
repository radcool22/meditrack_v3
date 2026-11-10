import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { rememberCallIntent } from './utils/callApi'
import './index.css'

// Before routing redirects drop the query string (?call=1 from meditrack.in).
rememberCallIntent()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
