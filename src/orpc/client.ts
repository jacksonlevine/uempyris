import { createRouterClient } from '@orpc/server'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getAuth } from '@workos/authkit-tanstack-react-start'

import type { RouterClient } from '@orpc/server'

import router from '#/orpc/router'

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(router, {
      // SSR calls run in-process; resolve the session the same way the
      // HTTP route handlers do.
      context: async () => ({
        auth: await getAuth(),
      }),
    }),
  )
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({
      url: `${window.location.origin}/api/rpc`,
    })
    return createORPCClient(link)
  })

export const client: RouterClient<typeof router> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
