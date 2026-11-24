import { randomUUID, timingSafeEqual } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider'
import express from 'express'

const MAX_BYTES = 1024 * 1024
const PREFIX = 'upload-test/'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const { AWS_REGION, AWS_ROLE_ARN, AWS_ACCOUNT_ID, S3_BUCKET_NAME, S3_TEST_TOKEN } = process.env
const s3 = new S3Client({
  region: AWS_REGION,
  ...(AWS_ROLE_ARN && { credentials: awsCredentialsProvider({ roleArn: AWS_ROLE_ARN }) }),
})
const bucket = { Bucket: S3_BUCKET_NAME, ExpectedBucketOwner: AWS_ACCOUNT_ID }
const router = express.Router()

router.use((request, response, next) => {
  response.set('Cache-Control', 'no-store')

  if (!S3_TEST_TOKEN) {
    return response.status(503).json({ error: 'The S3 test is disabled. Set S3_TEST_TOKEN on the server.' })
  }

  const supplied = Buffer.from(request.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${S3_TEST_TOKEN}`)
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return response.status(401).json({ error: 'Invalid test token.' })
  }

  if (!AWS_REGION || !S3_BUCKET_NAME || (process.env.VERCEL && !AWS_ROLE_ARN)) {
    return response.status(503).json({ error: 'The server is missing its S3 configuration.' })
  }

  next()
})

router.post('/', express.raw({ type: 'application/octet-stream', limit: MAX_BYTES, inflate: false }), async (request, response) => {
  if (!request.is('application/octet-stream')) {
    return response.status(415).json({ error: 'Send the file as application/octet-stream.' })
  }
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    return response.status(400).json({ error: 'Choose a non-empty file.' })
  }

  const id = randomUUID()
  try {
    await s3.send(new PutObjectCommand({
      ...bucket,
      Key: `${PREFIX}${id}`,
      Body: request.body,
      ContentType: 'application/octet-stream',
    }))
    return response.status(201).json({ id })
  } catch (error) {
    console.error('S3 test upload failed:', error.name)
    return response.status(502).json({ error: 'S3 upload failed. Check the server logs and AWS role permissions.' })
  }
})

router.get('/:id', async (request, response) => {
  const { id } = request.params
  if (!UUID.test(id)) {
    return response.status(400).json({ error: 'Invalid test file ID.' })
  }

  try {
    const { Body } = await s3.send(new GetObjectCommand({ ...bucket, Key: `${PREFIX}${id}` }))
    const file = Buffer.from(await Body.transformToByteArray())
    return response.attachment('s3-test-download').type('application/octet-stream').send(file)
  } catch (error) {
    if (error.name === 'NoSuchKey') {
      return response.status(404).json({ error: 'Test file not found.' })
    }
    console.error('S3 test download failed:', error.name)
    return response.status(502).json({ error: 'S3 download failed. Check the server logs and AWS role permissions.' })
  }
})

router.use((error, _request, response, next) => {
  if (error.status === 413) {
    return response.status(413).json({ error: 'Test files must be 1 MiB or smaller.' })
  }
  if (error.status === 415) {
    return response.status(415).json({ error: 'Send an uncompressed file body.' })
  }
  next(error)
})

export default router
