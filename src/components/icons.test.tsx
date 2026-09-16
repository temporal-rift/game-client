import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GradeBadge } from './icons'

describe('GradeBadge', () => {
  it('renders the exact grade for a normal integer value', () => {
    render(<GradeBadge grade={3} />)

    expect(screen.getByLabelText('Grade 3')).toHaveTextContent('III')
  })

  it('rounds a fractional grade and keeps the numeral and label consistent', () => {
    render(<GradeBadge grade={2.7} />)

    expect(screen.getByLabelText('Grade 3')).toHaveTextContent('III')
  })

  it('clamps an out-of-range grade instead of indexing past the numeral list', () => {
    render(<GradeBadge grade={9} />)

    expect(screen.getByLabelText('Grade 5')).toHaveTextContent('V')
  })

  it('falls back to grade 0 for a non-finite value instead of rendering undefined', () => {
    render(<GradeBadge grade={Number.NaN} />)

    expect(screen.getByLabelText('Grade 0')).toHaveTextContent('0')
  })
})
