// client/src/components/common/MultiSelect.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X, Search } from 'lucide-react';

const MultiSelect = ({ 
    options = [], 
    selected = [], 
    onChange, 
    placeholder = 'Select...', 
    className = '',
    maxDisplay = 2,
    searchable = true // New prop to enable/disable search
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef(null);
    const searchInputRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchTerm(''); // Clear search when closing
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Focus search input when dropdown opens
    useEffect(() => {
        if (isOpen && searchable && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen, searchable]);

    const handleToggle = (value) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onChange(newSelected);
    };

    const handleClear = (e) => {
        e.stopPropagation();
        onChange([]);
        setSearchTerm('');
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

    // Filter options based on search term
    const filteredOptions = options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSearchChange = (e) => {
        e.stopPropagation();
        setSearchTerm(e.target.value);
    };

    const handleSearchKeyDown = (e) => {
        // Prevent closing dropdown when typing
        e.stopPropagation();
        
        // Select first filtered option on Enter
        if (e.key === 'Enter' && filteredOptions.length > 0) {
            e.preventDefault();
            handleToggle(filteredOptions[0].value);
        }
        
        // Close on Escape
        if (e.key === 'Escape') {
            setIsOpen(false);
            setSearchTerm('');
        }
    };

    return (
        <div ref={dropdownRef} className={`relative flex-shrink-0 ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded bg-white text-gray-700 focus:ring-black focus:border-black flex items-center justify-between hover:bg-gray-50"
            >
                <span className="truncate min-w-0 flex-1">{getDisplayText()}</span>
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
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
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded shadow-lg min-w-max">
                    {/* Search Input */}
                    {searchable && (
                        <div className="p-1.5 border-b border-gray-200">
                            <div className="relative">
                                <Search size={12} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    value={searchTerm}
                                    onChange={handleSearchChange}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search..."
                                    className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                                    onClick={(e) => e.stopPropagation()}
                                />
                                {searchTerm && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSearchTerm('');
                                            searchInputRef.current?.focus();
                                        }}
                                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                    >
                                        <X size={10} />
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* Options List */}
                    <div className="max-h-48 overflow-y-auto">
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-gray-500">
                                {searchTerm ? 'No matches found' : 'No options available'}
                            </div>
                        ) : (
                            filteredOptions.map((option) => (
                                <div
                                    key={option.value}
                                    onClick={() => handleToggle(option.value)}
                                    className={`px-3 py-1.5 text-xs hover:bg-gray-100 cursor-pointer flex items-center justify-between ${
                                        selected.includes(option.value) ? 'bg-gray-50' : ''
                                    }`}
                                >
                                    <span className="truncate">{option.label}</span>
                                    {selected.includes(option.value) && (
                                        <Check size={12} className="text-gray-900 flex-shrink-0 ml-2" />
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                    
                    {/* Selected count footer */}
                    {selected.length > 0 && (
                        <div className="px-3 py-1.5 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex items-center justify-between">
                            <span>{selected.length} selected</span>
                            <button
                                onClick={handleClear}
                                className="text-red-500 hover:text-red-700 font-medium"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MultiSelect;