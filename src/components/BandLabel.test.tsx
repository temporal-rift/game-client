import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandLabel } from './BandLabel'

describe('BandLabel', () => {
  it('renders a qualitative public band as readable text', () => {
    render(<BandLabel band="medium" />)

    expect(screen.getByText('Medium')).toBeInTheDocument()
  })

  it('keeps unavailable probability information explicitly unknown', () => {
    render(<BandLabel band="unknown" />)

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
