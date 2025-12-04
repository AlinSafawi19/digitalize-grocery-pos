import React, { useEffect, useState, useCallback } from 'react';
import { TableBody, TableRow, TableCell } from '@mui/material';

interface VirtualizedTableBodyProps<T> {
  items: T[];
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
  emptyColSpan?: number;
  rowHeight?: number;
  overscan?: number;
  tableContainerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * PERFORMANCE FIX: Virtualized TableBody component
 * Only renders visible rows based on scroll position, dramatically improving performance for large lists
 * Works with Material-UI Table structure by only rendering visible rows inside TableBody
 * 
 * Usage:
 * <TableContainer ref={tableContainerRef}>
 *   <Table>
 *     <TableHead>...</TableHead>
 *     <VirtualizedTableBody
 *       items={products}
 *       renderRow={(product, index) => <ProductRow key={product.id} product={product} />}
 *       emptyMessage="No products found"
 *       emptyColSpan={9}
 *       rowHeight={80}
 *       tableContainerRef={tableContainerRef}
 *     />
 *   </Table>
 * </TableContainer>
 */
function VirtualizedTableBody<T extends { id: number | string }>({
  items,
  renderRow,
  emptyMessage = 'No items found',
  emptyColSpan = 1,
  rowHeight = 80,
  overscan = 5,
  tableContainerRef,
}: VirtualizedTableBodyProps<T>) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Math.min(50, items.length) });

  // Calculate visible range based on scroll position of table container
  const updateVisibleRange = useCallback(() => {
    if (!tableContainerRef?.current || items.length === 0) {
      // If no container ref, render first 50 items
      setVisibleRange({ start: 0, end: Math.min(50, items.length) });
      return;
    }

    const container = tableContainerRef.current;
    const scrollTop = container.scrollTop || 0;
    const clientHeight = container.clientHeight || 600;

    // Calculate which rows are visible
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(clientHeight / rowHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);

    setVisibleRange({ start, end });
  }, [items.length, rowHeight, overscan, tableContainerRef]);

  // Set up scroll listener on table container
  useEffect(() => {
    const container = tableContainerRef?.current;
    if (!container) {
      // Fallback: render first batch
      updateVisibleRange();
      return;
    }

    // Initial calculation
    updateVisibleRange();

    // Update on scroll
    container.addEventListener('scroll', updateVisibleRange, { passive: true });
    
    // Update on resize
    const resizeObserver = new ResizeObserver(updateVisibleRange);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateVisibleRange);
      resizeObserver.disconnect();
    };
  }, [updateVisibleRange, tableContainerRef]);

  // Update when items change
  useEffect(() => {
    updateVisibleRange();
  }, [items.length, updateVisibleRange]);

  if (items.length === 0) {
    return (
      <TableBody>
        <TableRow>
          <TableCell colSpan={emptyColSpan} align="center">
            {emptyMessage}
          </TableCell>
        </TableRow>
      </TableBody>
    );
  }

  // For small lists (< 50 items), render normally (no virtualization overhead)
  if (items.length <= 50) {
    return (
      <TableBody>
        {items.map((item, index) => (
          <React.Fragment key={item.id || index}>
            {renderRow(item, index)}
          </React.Fragment>
        ))}
      </TableBody>
    );
  }

  // For large lists, only render visible rows
  const visibleItems = items.slice(visibleRange.start, visibleRange.end);

  return (
    <TableBody>
      {/* Spacer row for items before visible range */}
      {visibleRange.start > 0 && (
        <TableRow style={{ height: visibleRange.start * rowHeight, visibility: 'hidden' }}>
          <TableCell colSpan={emptyColSpan} style={{ padding: 0, border: 'none' }} />
        </TableRow>
      )}
      
      {/* Visible rows */}
      {visibleItems.map((item, index) => (
        <React.Fragment key={item.id || visibleRange.start + index}>
          {renderRow(item, visibleRange.start + index)}
        </React.Fragment>
      ))}
      
      {/* Spacer row for items after visible range */}
      {visibleRange.end < items.length && (
        <TableRow style={{ height: (items.length - visibleRange.end) * rowHeight, visibility: 'hidden' }}>
          <TableCell colSpan={emptyColSpan} style={{ padding: 0, border: 'none' }} />
        </TableRow>
      )}
    </TableBody>
  );
}

export default VirtualizedTableBody;

