import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkerDetail from '../MarkerDetail';
import type { Marker } from '../../types/marker';

vi.mock('../../hooks/useMarkerResearch', () => ({
  useMarkerResearch: () => ({ research: null, loading: false, error: null }),
}));

const marker: Marker = {
  id: 1,
  markerNumber: '1234',
  title: 'The Alamo',
  county: 'Bexar',
  city: 'San Antonio',
  lat: 29.426,
  lng: -98.4861,
  markerText: 'Site of the famous 1836 battle for Texas independence. The mission was defended by a small group of Texians against the Mexican army.',
  markerDate: '1936',
  subjectCodes: ['military', 'buildings'],
  isRTHL: true,
  size: '18" x 28"',
};

describe('MarkerDetail [REQ:marker-detail]', () => {
  it('renders marker title [AC:MD-01]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText('The Alamo')).toBeInTheDocument();
  });

  it('renders marker number [AC:MD-02]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText('#1234')).toBeInTheDocument();
  });

  it('renders full inscription text [AC:MD-03]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText(/Site of the famous 1836 battle/)).toBeInTheDocument();
  });

  it('renders county and city [AC:MD-04]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText(/San Antonio/)).toBeInTheDocument();
    expect(screen.getByText(/Bexar/)).toBeInTheDocument();
  });

  it('renders marker date [AC:MD-05]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText('1936')).toBeInTheDocument();
  });

  it('renders subject codes [AC:MD-06]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText(/Military/)).toBeInTheDocument();
    expect(screen.getByText(/Buildings/)).toBeInTheDocument();
  });

  it('shows RTHL badge for RTHL markers [AC:MD-07]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText('RTHL')).toBeInTheDocument();
  });

  it('renders a Get Directions link [AC:MD-08]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    const link = screen.getByRole('link', { name: /directions/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', expect.stringContaining('29.426'));
  });

  it('renders a back button [AC:MD-09]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked [AC:MD-10]', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<MarkerDetail marker={marker} onBack={onBack} />);

    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it('renders marker size [AC:MD-11]', () => {
    render(<MarkerDetail marker={marker} onBack={() => {}} />);
    expect(screen.getByText('18" x 28"')).toBeInTheDocument();
  });
});
