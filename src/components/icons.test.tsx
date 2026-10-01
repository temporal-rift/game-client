import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { GradeBadge } from './icons'

describe('GradeBadge', () => {
  it('shows the contract grade as its numeral and accessible label', () => {
    render(<GradeBadge grade="III" />)

    expect(screen.getByLabelText('Grade III')).toHaveTextContent('III')
  })
})
