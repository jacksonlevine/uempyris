import { createCsrfMiddleware, createStart } from '@tanstack/react-start'
import { authkitMiddleware } from '@workos/authkit-tanstack-react-start'

// Defining our own startInstance opts out of Start's default CSRF protection
// for server functions; createCsrfMiddleware restores it. Must run before
// authkitMiddleware so cross-site requests die before any session work.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [csrfMiddleware, authkitMiddleware()],
}))
