import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkerCard from '../MarkerCard';
import type { Marker } from '../../types/marker';

const marker: Marker = {
  id: 1,
  markerNumber: '1234',
  title: 'The Alamo',
  county: 'Bexar',
  city: 'San Antonio',
  lat: 29.4260,
  lng: -98.4861,
  markerText: 'Site of the famous 1836 battle for Texas independence.',
  markerDate: '1936',
  subjectCodes: ['military', 'buildings'],
  isRTHL: true,
  size: '18" x 28"',
};

describe('MarkerCard [REQ:search]', () => {
  it('renders marker number [AC:CARD-01]', () => {
    render(<MarkerCard marker={marker} onClick={() => {}} />);
    expect(screen.getByText('#1234')).toBeInTheDocument();
  });

  it('renders marker title [AC:CARD-02]', () => {
    render(<MarkerCard marker={marker} onClick={() => {}} />);
    expect(screen.getByText('The Alamo')).toBeInTheDocument();
  });

  it('renders county and city [AC:CARD-03]', () => {
    render(<MarkerCard marker={marker} onClick={() => {}} />);
    expect(screen.getByText(/San Antonio/)).toBeInTheDocument();
    expect(screen.getByText(/Bexar/)).toBeInTheDocument();
  });

  it('truncates long marker text [AC:CARD-04]', () => {
    const longTextMarker = {
      ...marker,
      markerText: 'A'.repeat(200),
    };
    render(<MarkerCard marker={longTextMarker} onClick={() => {}} />);
    // Should not render the full 200 chars
    const textEl = screen.getByTestId('marker-text-preview');
    expect(textEl.textContent!.length).toBeLessThan(200);
  });

  it('calls onClick when clicked [AC:CARD-05]', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MarkerCard marker={marker} onClick={onClick} />);

    await user.click(screen.getByRole('button', { name: /The Alamo/ }));
    expect(onClick).toHaveBeenCalledWith(marker);
  });

  it('reaches the card with Tab and opens the marker with Enter [AC:OMA-UX-A11Y-1]', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<MarkerCard marker={marker} onClick={onClick} />);

    await user.tab();
    expect(screen.getByRole('button', { name: /The Alamo/ })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledWith(marker);
  });

  it('shows RTHL badge for RTHL markers [AC:CARD-06]', () => {
    render(<MarkerCard marker={marker} onClick={() => {}} />);
    expect(screen.getByText('RTHL')).toBeInTheDocument();
  });

  it('does not show RTHL badge for non-RTHL markers [AC:CARD-07]', () => {
    render(<MarkerCard marker={{ ...marker, isRTHL: false }} onClick={() => {}} />);
    expect(screen.queryByText('RTHL')).not.toBeInTheDocument();
  });
});
