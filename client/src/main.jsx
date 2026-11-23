import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

function App() {
  return (
    <main>
      <h1>Event Album</h1>
      <p>A place to collect photos and videos from your events.</p>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
