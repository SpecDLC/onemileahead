interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export default function SearchInput({ value, onChange, autoFocus }: SearchInputProps) {
  return (
    <div className="search-input-wrapper">
      <input
        type="search"
        role="searchbox"
        className="search-input"
        inputMode="numeric"
        placeholder="Marker # or keyword..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
      />
      {value && (
        <button
          className="search-clear"
          aria-label="Clear search"
          onClick={() => onChange('')}
        >
          &times;
        </button>
      )}
    </div>
  );
}
