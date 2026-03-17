import React, { useRef, useCallback, useState } from 'react';

const ResizableTableHeader = ({ columnId, label, width, onResize, minWidth = 50, maxWidth = 800, children }) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;

    const handleMouseMove = (moveEvent) => {
      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(minWidth, Math.min(maxWidth, startWidthRef.current + diff));
      onResize(columnId, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnId, width, onResize, minWidth, maxWidth]);

  return (
    <th 
      className="px-2 py-1.5 text-center border-r border-white/10 relative group text-[10px] uppercase tracking-wider font-medium whitespace-nowrap"
      style={{ width: `${width}px`, minWidth: `${minWidth}px`, maxWidth: `${maxWidth}px` }}
    >
      {children || label}
      
      {/* Resize Handle */}
      <div
        className={`absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 transition-colors ${
          isResizing ? 'bg-blue-500' : 'bg-transparent group-hover:bg-blue-300'
        }`}
        onMouseDown={handleMouseDown}
        style={{ zIndex: 10 }}
      />
    </th>
  );
};

export default ResizableTableHeader;
