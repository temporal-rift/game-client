import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BandMeter, BandPatternDefs } from './BandMeter'

function renderMeter(band: string) {
  return render(
    <>
      <BandPatternDefs />
      <BandMeter band={band} />
    </>,
  )
}

describe('BandMeter', () => {
  it('renders exact readable numbers for a valid band', () => {
    renderMeter('40 / 40 / 20')

    expect(screen.getByText('40 / 40 / 20')).toBeInTheDocument()
  })

  it('treats a malformed component as unknown instead of parsing a numeric prefix', () => {
    renderMeter('2x / 3')

    expect(screen.getByText('Unknown')).toBeInTheDocument()
    expect(screen.queryByText(/^2/)).not.toBeInTheDocument()
  })

  it('hides the decorative svg from assistive technology since the text conveys the same value', () => {
    const { container } = renderMeter('40 / 40 / 20')

    const svg = container.querySelector('svg[width="160"]')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
    expect(svg).not.toHaveAttribute('aria-label')
  })
})
