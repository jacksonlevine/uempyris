import '#/polyfill'

import { RPCHandler } from '@orpc/server/fetch'
import { createFileRoute } from '@tanstack/react-router'
import { getAuth } from '@workos/authkit-tanstack-react-start'
import router from '#/orpc/router'

const handler = new RPCHandler(router)

async function handle({ request }: { request: Request }) {
  // Session is resolved here, in a server route handler (a documented
  // getAuth() call site), and handed to procedures as oRPC initial context.
  const auth = await getAuth()
  const { response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: { auth },
  })

  return response ?? new Response('Not Found', { status: 404 })
}

export const Route = createFileRoute('/api/rpc/$')({
  server: {
    handlers: {
      HEAD: handle,
      GET: handle,
      POST: handle,
      PUT: handle,
      PATCH: handle,
      DELETE: handle,
    },
  },
})
