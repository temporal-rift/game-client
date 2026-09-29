import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { render, renderHook, type RenderHookOptions, type RenderOptions } from '@testing-library/react'
import { createElement, type ReactElement, type ReactNode } from 'react'
import { createQueryClient } from '../api/queryClient'

/** A fresh cache per test, configured like the app's. */
export function createTestQueryClient(): QueryClient {
  return createQueryClient()
}

function wrapperFor(client: QueryClient) {
  return ({ children }: { readonly children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
}

/** `renderHook` under its own query cache (or the one given). */
export function renderHookWithQueries<Result, Props>(
  callback: (props: Props) => Result,
  options: RenderHookOptions<Props> & { readonly queryClient?: QueryClient } = {},
) {
  const { queryClient = createTestQueryClient(), ...rest } = options
  return { queryClient, ...renderHook(callback, { wrapper: wrapperFor(queryClient), ...rest }) }
}

/** `render` under its own query cache (or the one given). */
export function renderWithQueries(ui: ReactElement, options: RenderOptions & { readonly queryClient?: QueryClient } = {}) {
  const { queryClient = createTestQueryClient(), ...rest } = options
  return { queryClient, ...render(ui, { wrapper: wrapperFor(queryClient), ...rest }) }
}
