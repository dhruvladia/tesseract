import { createAuthClient } from 'better-auth/react'
import { organizationClient } from 'better-auth/client/plugins'

// Same-origin in dev (Vite proxies /api) and in the Docker image (nginx proxies /api).
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  plugins: [organizationClient()],
})
