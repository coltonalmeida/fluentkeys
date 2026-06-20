import './env.js'
import { pool } from './db.js'
import { runJob, type JobType } from './jobs.js'

// Manual job runner: `npm run job:digest` / `:streak` / `:rivals`. Inert until
// RESEND_API_KEY is set (sends become logs). Used by an external scheduler too.
const arg = process.argv[2]
const types: JobType[] = ['digest', 'streak', 'rivals']
const type = (types as string[]).includes(arg ?? '') ? (arg as JobType) : 'digest'

runJob(type)
  .then((r) => {
    console.log('job complete:', r)
  })
  .catch((err) => {
    console.error('job failed:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
