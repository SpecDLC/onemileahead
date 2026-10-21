import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SearchInput from '../SearchInput';

describe('SearchInput [REQ:search]', () => {
  it('renders an input field [AC:UI-01]', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('displays the current value [AC:UI-02]', () => {
    render(<SearchInput value="1234" onChange={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveValue('1234');
  });

  it('calls onChange when user types [AC:UI-03]', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="" onChange={onChange} />);

    await user.type(screen.getByRole('searchbox'), '5');
    expect(onChange).toHaveBeenCalledWith('5');
  });

  it('has numeric inputmode for number keyboard [AC:UI-04]', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('inputmode', 'numeric');
  });

  it('has placeholder text [AC:UI-05]', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder');
  });

  it('shows a clear button when value is non-empty [AC:UI-06]', () => {
    render(<SearchInput value="test" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('hides clear button when value is empty [AC:UI-07]', () => {
    render(<SearchInput value="" onChange={() => {}} />);
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  it('calls onChange with empty string when clear is clicked [AC:UI-08]', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchInput value="test" onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith('');
  });
});
