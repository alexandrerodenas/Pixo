

import React, { useState, useEffect, useRef } from 'react';
import { PhotoStatus } from '../services/types.ts';
import { Loader, Check, AlertCircle, HelpCircle } from 'lucide-react';

export const Spinner: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
    <Loader className={`${className} animate-spin text-primary`} />
);

export const StatusPill: React.FC<{ status: PhotoStatus }> = ({ status }) => {
    const statusInfo = {
        [PhotoStatus.QUEUED]: { text: 'Queued', icon: <Loader className="w-3 h-3" />, color: 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200' },
        [PhotoStatus.ANALYZING]: { text: 'Analyzing...', icon: <Spinner className="w-3 h-3" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' },
        [PhotoStatus.ANALYZED]: { text: '', icon: <Check className="w-3.5 h-3.5" aria-label="Analysé" />, color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' },
        [PhotoStatus.UNCATEGORIZED]: { text: 'Uncategorized', icon: <HelpCircle className="w-3 h-3" />, color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' },
        [PhotoStatus.ERROR]: { text: 'Error', icon: <AlertCircle className="w-3 h-3" />, color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' },
    };
    const info = statusInfo[status as keyof typeof statusInfo];
    if (!info) return null;

    const { text, icon, color } = info;
    return (
        <div className={`absolute top-2 left-2 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
            {icon}
            {text && <span>{text}</span>}
        </div>
    );
};

interface AutoCompleteInputProps {
    value: string;
    onChange: (value: string) => void;
    suggestions: string[];
    placeholder?: string;
    inputClassName?: string;
}

export const AutoCompleteInput: React.FC<AutoCompleteInputProps> = ({
                                                                        value,
                                                                        onChange,
                                                                        suggestions,
                                                                        placeholder,
                                                                        inputClassName,
                                                                    }) => {
    const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([]);
    const [isDropdownVisible, setDropdownVisible] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setDropdownVisible(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [wrapperRef]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;
        onChange(inputValue);

        if (inputValue) {
            const filtered = suggestions.filter(s =>
                s.toLowerCase().includes(inputValue.toLowerCase())
            );
            setFilteredSuggestions(filtered);
            setDropdownVisible(filtered.length > 0);
        } else {
            setDropdownVisible(false);
            setFilteredSuggestions([]);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        onChange(suggestion);
        setFilteredSuggestions([]);
        setDropdownVisible(false);
    };

    const handleInputFocus = () => {
        if (value && filteredSuggestions.length > 0) {
            setDropdownVisible(true);
        }
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <input
                type="text"
                value={value}
                onChange={handleInputChange}
                onFocus={handleInputFocus}
                placeholder={placeholder}
                className={inputClassName}
                autoComplete="off"
            />
            {isDropdownVisible && filteredSuggestions.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredSuggestions.map((suggestion, index) => (
                        <li
                            key={index}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="px-3 py-2 cursor-pointer hover:bg-primary/10 dark:hover:bg-primary/20"
                        >
                            {suggestion}
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};


export const Tooltip: React.FC<{ content: string; children: React.ReactNode, side?: 'top' | 'right' | 'bottom' | 'left' }> = ({ content, children, side = 'right' }) => {
    const sideClasses = {
        right: 'left-full ml-2 top-1/2 -translate-y-1/2',
        left: 'right-full mr-2 top-1/2 -translate-y-1/2',
        top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
        bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    };

    const originClasses = {
        right: 'origin-left',
        left: 'origin-right',
        top: 'origin-bottom',
        bottom: 'origin-top',
    }

    return (
        <div className="relative group flex items-center">
            {children}
            <div
                className={`
          absolute ${sideClasses[side]} 
          w-auto px-2 py-1 min-w-max rounded-md shadow-md 
          text-white bg-gray-900 dark:bg-gray-950
          text-xs font-bold 
          transition-all duration-100 scale-0 group-hover:scale-100 ${originClasses[side]}
          z-50 pointer-events-none
        `}
            >
                {content}
            </div>
        </div>
    );
};