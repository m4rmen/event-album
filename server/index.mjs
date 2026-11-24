import express from 'express'
import s3TestRouter from './s3-test.mjs'

const app = express()
const port = Number(process.env.PORT ?? 3001)

app.use('/api/s3-test', s3TestRouter)
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok' })
})

app.listen(port, () => {
  console.log(`Event Album API listening on http://localhost:${port}`)
})
