// client/src/components/common/MultiSelect.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';

const MultiSelect = ({ 
    options = [], 
    selected = [], 
    onChange, 
    placeholder = 'Select...', 
    className = '',
    maxDisplay = 2 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleToggle = (value) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange([]);
    };

    const getDisplayText = () => {
        if (selected.length === 0) return placeholder;
        if (selected.length <= maxDisplay) {
            return selected
                .map(val => options.find(opt => opt.value === val)?.label)
                .filter(Boolean)
                .join(', ');
        }
        return `${selected.length} selected`;
    };

    return (
        <div ref={dropdownRef} className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:ring-black focus:border-black flex items-center justify-between hover:bg-gray-50"
            >
                <span className="truncate">{getDisplayText()}</span>
                <div className="flex items-center gap-1">
                    {selected.length > 0 && (
                        <X 
                            size={12} 
                            onClick={handleClear}
                            className="text-gray-400 hover:text-red-500 cursor-pointer"
                        />
                    )}
                    <ChevronDown size={12} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-y-auto">
                    {options.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-gray-500">No options available</div>
                    ) : (
                        options.map((option) => (
                            <div
                                key={option.value}
                                onClick={() => handleToggle(option.value)}
                                className="px-3 py-2 text-xs hover:bg-gray-100 cursor-pointer flex items-center justify-between"
                            >
                                <span className="truncate">{option.label}</span>
                                {selected.includes(option.value) && (
                                    <Check size={12} className="text-green-600 flex-shrink-0" />
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;