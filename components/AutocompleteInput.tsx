
import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface AutocompleteInputProps {
  value: string;
  onChange: (newValue: string) => void;
  suggestions: string[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

const AutocompleteInput: React.FC<AutocompleteInputProps> = ({
                                                               value,
                                                               onChange,
                                                               suggestions,
                                                               placeholder,
                                                               icon,
                                                               className
                                                             }) => {
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const suggestionsListRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (showSuggestions && suggestionsListRef.current) {
      const activeItem = suggestionsListRef.current.children[activeSuggestionIndex] as HTMLLIElement;
      if (activeItem) {
        activeItem.scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [activeSuggestionIndex, showSuggestions]);

  const handleClear = () => {
    onChange('');
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const userInput = e.currentTarget.value;
    const lowercasedInput = userInput.toLowerCase();

    const newFilteredSuggestions = lowercasedInput.length > 0
        ? suggestions.filter(suggestion => suggestion.toLowerCase().includes(lowercasedInput))
        : suggestions;

    onChange(userInput);
    setFilteredSuggestions(newFilteredSuggestions);
    setShowSuggestions(true);
    setActiveSuggestionIndex(0);
  };

  const handleFocus = () => {
    const lowercasedInput = value.toLowerCase();
    const newFilteredSuggestions = lowercasedInput.length > 0
        ? suggestions.filter(suggestion => suggestion.toLowerCase().includes(lowercasedInput))
        : suggestions;

    setFilteredSuggestions(newFilteredSuggestions);
    setShowSuggestions(true);
  };

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion);
    setFilteredSuggestions([]);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSuggestions(false);
      return;
    }

    if (!showSuggestions || filteredSuggestions.length === 0) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      onChange(filteredSuggestions[activeSuggestionIndex]);
      setShowSuggestions(false);
    }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev > 0 ? prev - 1 : 0);
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestionIndex(prev => prev < filteredSuggestions.length - 1 ? prev + 1 : filteredSuggestions.length - 1);
    }
  };

  return (
      <div ref={wrapperRef} className="relative">
        <div className="relative">
          {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400">{icon}</div>}
          <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={handleFocus}
              placeholder={placeholder}
              autoComplete="off"
              className={className || `w-full ${icon ? 'pl-10' : 'pl-3'} ${value ? 'pr-10' : 'pr-3'} py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-primary focus:outline-none transition-all`}
          />
          {value && (
              <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 p-1 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
                  aria-label="Effacer le filtre"
              >
                <X className="w-4 h-4" />
              </button>
          )}
        </div>
        {showSuggestions && filteredSuggestions.length > 0 && (
            <ul ref={suggestionsListRef} className="absolute z-20 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md mt-1 max-h-60 overflow-y-auto shadow-lg">
              {filteredSuggestions.map((suggestion, index) => (
                  <li
                      className={`p-2 cursor-pointer capitalize ${index === activeSuggestionIndex ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-600'}`}
                      key={suggestion}
                      onClick={() => handleSuggestionClick(suggestion)}
                      onMouseEnter={() => setActiveSuggestionIndex(index)}
                  >
                    {suggestion}
                  </li>
              ))}
            </ul>
        )}
      </div>
  );
};

export default AutocompleteInput;
