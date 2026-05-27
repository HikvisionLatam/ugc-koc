import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles.css'

// Leer parámetros del query string (soportado desde AEM)
const params   = new URLSearchParams(window.location.search)
const site     = params.get('site')    ?? 'latam'
const landing  = params.get('landing') ?? 'colorvu'
const apiUrl   = params.get('api')     ?? '/api/ugc/iframe'
const style    = (params.get('style')  ?? 'classic') as 'classic' | 'premium'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App
      site={site}
      landing={landing}
      apiUrl={apiUrl}
      style={style}
    />
  </React.StrictMode>
)
