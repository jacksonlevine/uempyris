import { createRouterClient } from '@orpc/server'
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { getRequestHeaders } from '@tanstack/react-start/server'
import { createIsomorphicFn } from '@tanstack/react-start'

import type { RouterClient } from '@orpc/server'

import router from '#/orpc/router'

// The WorkOS access token lives inside React (useAuth); this module doesn't.
// Page registers a getter once after sign-in, and every RPC call pulls a
// fresh token through it (authkit refreshes tokens internally).
let getToken: (() => Promise<string>) | null = null
export function registerTokenGetter(fn: () => Promise<string>) {
  getToken = fn
}

const getORPCClient = createIsomorphicFn()
  .server(() =>
    createRouterClient(router, {
      context: () => ({
        headers: getRequestHeaders(),
      }),
    }),
  )
  .client((): RouterClient<typeof router> => {
    const link = new RPCLink({
      url: `${window.location.origin}/api/rpc`,
      headers: async () =>
        getToken ? { authorization: `Bearer ${await getToken()}` } : {},
    })
    return createORPCClient(link)
  })

export const client: RouterClient<typeof router> = getORPCClient()

export const orpc = createTanstackQueryUtils(client)
