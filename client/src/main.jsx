import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'

const TEST_API = '/api/s3-test'
const MAX_BYTES = 1024 * 1024

async function testRequest(path, token, options = {}) {
  const response = await fetch(`${TEST_API}${path}`, {
    ...options,
    headers: { ...options.headers, Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    const details = await response.json().catch(() => null)
    throw new Error(details?.error ?? `Request failed (${response.status}).`)
  }

  return response
}

function App() {
  const [token, setToken] = useState('')
  const [file, setFile] = useState(null)
  const [uploaded, setUploaded] = useState(null)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  async function upload(event) {
    event.preventDefault()
    setUploaded(null)
    if (!file || file.size === 0 || file.size > MAX_BYTES) {
      setMessage('Choose a non-empty file that is 1 MiB or smaller.')
      return
    }

    setPending(true)
    setMessage('Uploading…')
    try {
      const response = await testRequest('', token, {
        method: 'POST',
        body: file,
        headers: { 'Content-Type': 'application/octet-stream' },
      })
      const { id } = await response.json()
      setUploaded({ id, name: file.name })
      setMessage(`Uploaded ${file.name} to S3.`)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setPending(false)
    }
  }

  async function download() {
    setPending(true)
    setMessage('Downloading…')
    try {
      const response = await testRequest(`/${uploaded.id}`, token)
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement('a')
      link.href = url
      link.download = uploaded.name
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setMessage('Downloaded the file from S3.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <h1>Event Album</h1>
      <p>A place to collect photos and videos from your events.</p>
      <section aria-labelledby="s3-test">
        <h2 id="s3-test">S3 upload and download test</h2>
        <p>Choose a file up to 1 MiB.</p>
        <form onSubmit={upload}>
          <p>
            <label>
              Test token{' '}
              <input type="password" value={token} onChange={(event) => setToken(event.target.value)} required />
            </label>
          </p>
          <p>
            <label>
              File{' '}
              <input type="file" onChange={(event) => setFile(event.target.files[0] ?? null)} required />
            </label>
          </p>
          <button disabled={pending || !token || !file}>Upload file</button>{' '}
          <button type="button" onClick={download} disabled={pending || !token || !uploaded}>
            Download uploaded file
          </button>
        </form>
        <p role="status">{message}</p>
      </section>
    </main>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
