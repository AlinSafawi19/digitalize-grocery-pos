import React, { useState, useMemo, useCallback, memo } from 'react';
import {
  Box,
  Typography,
  Collapse,
  Chip,
} from '@mui/material';
import { KeyboardArrowRight, KeyboardArrowDown, Folder, FolderOpen } from '@mui/icons-material';

interface Category {
  id: number;
  name: string;
  description: string | null;
  parentId: number | null;
  children?: Category[];
}

interface CategoryTreeViewProps {
  categories: Category[];
  onCategorySelect?: (category: Category) => void;
  selectedCategoryId?: number | null;
}

interface CategoryItemProps {
  category: Category;
  level: number;
  isExpanded: boolean;
  isSelected: boolean;
  expandedSet: Set<number>;
  selectedCategoryId: number | null | undefined;
  onToggleExpand: (categoryId: number) => void;
  onSelect: (category: Category) => void;
  isLast: boolean;
  parentPath: boolean[];
}

/* eslint-disable react/prop-types */
const CategoryItem = memo<CategoryItemProps>(({
  category,
  level,
  isExpanded,
  isSelected,
  expandedSet,
  selectedCategoryId,
  onToggleExpand,
  onSelect,
  isLast,
  parentPath,
}) => {
  const hasChildren = category.children && category.children.length > 0;

  const handleClick = useCallback(() => {
    // Single click: expand/collapse if category has children
    // Don't navigate to edit on single click
    if (hasChildren) {
      onToggleExpand(category.id);
    }
  }, [hasChildren, category.id, onToggleExpand]);

  const handleDoubleClick = useCallback(() => {
    // Double-click to edit
    onSelect(category);
  }, [category, onSelect]);

  const handleExpandClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      onToggleExpand(category.id);
    }
  }, [hasChildren, category.id, onToggleExpand]);

  // Memoize sx prop objects
  const chipSx = useMemo(() => ({
    fontSize: '11px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 500,
    height: '20px',
    borderColor: '#c0c0c0',
    color: '#616161',
  }), []);


  const descriptionChip = useMemo(() => {
    if (!category.description) return null;
    return (
      <Chip
        label={category.description}
        size="small"
        variant="outlined"
        sx={chipSx}
      />
    );
  }, [category.description, chipSx]);

  const renderChildren = useMemo(() => {
    if (!hasChildren || !isExpanded) return null;
    
    const children = category.children!;
    return children.map((child, index) => {
      const childIsExpanded = expandedSet.has(child.id);
      const childIsSelected = selectedCategoryId === child.id;
      const childIsLast = index === children.length - 1;
      const childParentPath = [...parentPath, !isLast];
      
      return (
        <CategoryItem
          key={child.id}
          category={child}
          level={level + 1}
          isExpanded={childIsExpanded}
          isSelected={childIsSelected}
          expandedSet={expandedSet}
          selectedCategoryId={selectedCategoryId}
          onToggleExpand={onToggleExpand}
          onSelect={onSelect}
          isLast={childIsLast}
          parentPath={childParentPath}
        />
      );
    });
  }, [hasChildren, isExpanded, category.children, level, expandedSet, selectedCategoryId, onToggleExpand, onSelect, isLast, parentPath]);

  // Memoize typography sx based on selection state
  const nameTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: isSelected ? '#1a237e' : '#212121',
  }), [isSelected]);

  // Build tree prefix string (│ ├─ └─)
  const treePrefix = useMemo(() => {
    if (level === 0) return '';
    
    let prefix = '';
    for (let i = 0; i < level - 1; i++) {
      prefix += parentPath[i] ? '│   ' : '    ';
    }
    prefix += isLast ? '└── ' : '├── ';
    
    return prefix;
  }, [level, parentPath, isLast]);

  const treeItemSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    cursor: 'pointer',
    fontFamily: 'monospace, "Courier New", monospace',
    fontSize: '13px',
    backgroundColor: isSelected ? '#e3f2fd' : 'transparent',
    borderLeft: isSelected ? '3px solid #1a237e' : '3px solid transparent',
    '&:hover': {
      backgroundColor: isSelected ? '#bbdefb' : '#f5f5f5',
    },
  }), [isSelected]);

  const expandIconSx = useMemo(() => ({
    width: '16px',
    height: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '4px',
    color: '#1a237e',
    flexShrink: 0,
  }), []);

  const folderIconSx = useMemo(() => ({
    fontSize: '16px',
    marginRight: '6px',
    color: isExpanded ? '#1a237e' : '#616161',
    flexShrink: 0,
  }), [isExpanded]);

  const nameBoxSx = useMemo(() => ({
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flex: 1,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  }), []);

  return (
    <Box>
      <Box
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        sx={treeItemSx}
      >
        {/* Tree prefix characters */}
        <Typography
          component="span"
          sx={{
            fontFamily: 'monospace, "Courier New", monospace',
            fontSize: '13px',
            color: '#808080',
            userSelect: 'none',
            whiteSpace: 'pre',
            flexShrink: 0,
          }}
        >
          {treePrefix}
        </Typography>
        
        {/* Expand/Collapse icon */}
        {hasChildren ? (
          <Box
            onClick={handleExpandClick}
            sx={expandIconSx}
          >
            {isExpanded ? (
              <KeyboardArrowDown sx={{ fontSize: '16px' }} />
            ) : (
              <KeyboardArrowRight sx={{ fontSize: '16px' }} />
            )}
          </Box>
        ) : (
          <Box sx={{ width: '16px', marginRight: '4px', flexShrink: 0 }} />
        )}
        
        {/* Folder icon */}
        <Box sx={folderIconSx}>
          {isExpanded ? (
            <FolderOpen sx={{ fontSize: '16px' }} />
          ) : (
            <Folder sx={{ fontSize: '16px' }} />
          )}
        </Box>
        
        {/* Category name and description */}
        <Box sx={nameBoxSx}>
          <Typography
            variant="body2"
            fontWeight={isSelected ? 'bold' : 'normal'}
            sx={nameTypographySx}
          >
            {category.name}
          </Typography>
          {descriptionChip}
        </Box>
      </Box>
      
      {/* Children */}
      {hasChildren && (
        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
          <Box>
            {renderChildren}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}, (prevProps, nextProps) => {
  // Custom comparison function for better performance
  // Only re-render if relevant props for this specific item have changed
  const prevHasChildren = prevProps.category.children && prevProps.category.children.length > 0;
  const nextHasChildren = nextProps.category.children && nextProps.category.children.length > 0;
  
  // Check if this specific item's expanded state changed
  const prevItemExpanded = prevProps.expandedSet.has(prevProps.category.id);
  const nextItemExpanded = nextProps.expandedSet.has(nextProps.category.id);
  
  return (
    prevProps.category.id === nextProps.category.id &&
    prevProps.category.name === nextProps.category.name &&
    prevProps.category.description === nextProps.category.description &&
    prevHasChildren === nextHasChildren &&
    prevProps.level === nextProps.level &&
    prevItemExpanded === nextItemExpanded &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.selectedCategoryId === nextProps.selectedCategoryId &&
    // Only check children if this item is expanded (to catch child changes)
    (!prevItemExpanded || prevProps.category.children === nextProps.category.children)
  );
});
/* eslint-enable react/prop-types */

CategoryItem.displayName = 'CategoryItem';

const CategoryTreeView: React.FC<CategoryTreeViewProps> = ({
  categories,
  onCategorySelect,
  selectedCategoryId,
}) => {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const toggleExpand = useCallback((categoryId: number) => {
    setExpanded((prev) => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(categoryId)) {
        newExpanded.delete(categoryId);
      } else {
        newExpanded.add(categoryId);
      }
      return newExpanded;
    });
  }, []);

  const handleCategorySelect = useCallback((category: Category) => {
    onCategorySelect?.(category);
  }, [onCategorySelect]);

  const renderCategory = useCallback((category: Category, level: number = 0, isLast: boolean = false, parentPath: boolean[] = []) => {
    const isExpanded = expanded.has(category.id);
    const isSelected = selectedCategoryId === category.id;

    return (
      <CategoryItem
        key={category.id}
        category={category}
        level={level}
        isExpanded={isExpanded}
        isSelected={isSelected}
        expandedSet={expanded}
        selectedCategoryId={selectedCategoryId}
        onToggleExpand={toggleExpand}
        onSelect={handleCategorySelect}
        isLast={isLast}
        parentPath={parentPath}
      />
    );
  }, [expanded, selectedCategoryId, toggleExpand, handleCategorySelect]);

  // Build tree structure - memoized to avoid rebuilding on every render
  const treeCategories = useMemo(() => {
    const categoryMap = new Map<number, Category>();
    const rootCategories: Category[] = [];

    // First pass: create map
    categories.forEach((cat) => {
      categoryMap.set(cat.id, { ...cat, children: [] });
    });

    // Second pass: build tree
    categories.forEach((cat) => {
      const category = categoryMap.get(cat.id)!;
      if (cat.parentId === null || !categoryMap.has(cat.parentId)) {
        rootCategories.push(category);
      } else {
        const parent = categoryMap.get(cat.parentId)!;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(category);
      }
    });

    return rootCategories;
  }, [categories]);

  const renderedCategories = useMemo(() => {
    return treeCategories.map((category, index) => {
      const isLast = index === treeCategories.length - 1;
      return renderCategory(category, 0, isLast, []);
    });
  }, [treeCategories, renderCategory]);

  // Memoize sx prop objects
  const emptyStateBoxSx = useMemo(() => ({
    p: 2,
    textAlign: 'center',
  }), []);

  const emptyStateTypographySx = useMemo(() => ({
    fontSize: '13px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    color: '#616161',
  }), []);

  if (treeCategories.length === 0) {
    return (
      <Box sx={emptyStateBoxSx}>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={emptyStateTypographySx}
        >
          No categories found
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '8px 0',
      }}
    >
      {renderedCategories}
    </Box>
  );
};

export default memo(CategoryTreeView);

