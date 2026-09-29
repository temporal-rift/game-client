import { RouterProvider, createMemoryHistory, createRootRoute, createRouter } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import { createElement, type ReactElement } from 'react'

/** Renders a component that uses router links, at `path`, without the app's routes. */
export async function renderInRouter(ui: ReactElement, path = '/') {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => ui }),
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  await router.load()
  return render(createElement(RouterProvider, { router }))
}
