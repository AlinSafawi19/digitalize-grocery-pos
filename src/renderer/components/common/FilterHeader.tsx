import React, { useCallback, useMemo, memo } from 'react';
import {
  Paper,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Autocomplete,
  CircularProgress,
  Grid,
} from '@mui/material';
import { FilterList, Search } from '@mui/icons-material';
import { SelectChangeEvent } from '@mui/material/Select';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

export interface FilterField {
  type: 'text' | 'select' | 'autocomplete' | 'date' | 'number';
  label: string;
  value: unknown;
  onChange: (value: unknown) => void;
  options?: Array<{ value: unknown; label: string }>;
  placeholder?: string;
  autocompleteOptions?: unknown[];
  getOptionLabel?: (option: unknown) => string;
  isOptionEqualToValue?: (option: unknown, value: unknown) => boolean;
  loading?: boolean;
  onInputChange?: (value: string) => void;
  onOpen?: () => void;
  renderInput?: (params: unknown) => React.ReactElement;
  ListboxProps?: Record<string, unknown>;
  noOptionsText?: string;
  minWidth?: number;
  fullWidth?: boolean;
  gridSize?: { xs?: number; sm?: number; md?: number };
}

interface FilterHeaderProps {
  fields: FilterField[];
  onClear: () => void;
  showHeader?: boolean;
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  clearButtonText?: string;
}

// Stable default functions to avoid recreation on every render
const defaultGetOptionLabel = (option: unknown) => {
  const opt = option as { name?: string; label?: string };
  return opt?.name || opt?.label || '';
};
const defaultIsOptionEqualToValue = (option: unknown, value: unknown) => {
  const opt = option as { id?: unknown };
  const val = value as { id?: unknown };
  return opt?.id === val?.id;
};

/* eslint-disable react/prop-types */
const FilterHeader: React.FC<FilterHeaderProps> = ({
  fields,
  onClear,
  showHeader = false,
  searchPlaceholder = 'Search...',
  searchValue,
  onSearchChange,
  clearButtonText = 'Clear Filters',
}) => {
  // Memoize search change handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange?.(e.target.value);
  }, [onSearchChange]);

  // Memoize clear handler
  const handleClear = useCallback(() => {
    onClear();
  }, [onClear]);

  // Get responsive grid sizes for a field
  const getGridSizes = useCallback((field: FilterField) => {
    if (field.gridSize) {
      return {
        xs: field.gridSize.xs ?? 12,
        sm: field.gridSize.sm ?? 6,
        md: field.gridSize.md ?? 4,
      };
    }
    // Default responsive sizes
    return {
      xs: 12,
      sm: 6,
      md: 4,
      lg: 3,
    };
  }, []);

  // Memoize shared field styles outside the map
  const fieldTextFieldSx = useMemo(
    () => ({
      '& .MuiOutlinedInput-root': {
        borderRadius: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        minHeight: '44px',
        backgroundColor: '#fff',
        '& input': {
          padding: '10px 14px',
        },
        '& fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
        '&:hover fieldset': {
          borderColor: '#000',
        },
        '&.Mui-focused fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
      },
      '& .MuiInputLabel-root': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
        '&.Mui-focused': {
          color: '#000',
        },
      },
      '& .MuiInputBase-input': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
      },
    }),
    []
  );

  const selectSx = useMemo(
    () => ({
      '& .MuiOutlinedInput-root': {
        borderRadius: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        minHeight: '44px',
        backgroundColor: '#fff',
        '& fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
        '&:hover fieldset': {
          borderColor: '#000',
        },
        '&.Mui-focused fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
      },
      '& .MuiInputLabel-root': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
        '&.Mui-focused': {
          color: '#000',
        },
      },
      '& .MuiSelect-select': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
        padding: '10px 14px',
      },
    }),
    []
  );

  const menuItemSx = useMemo(
    () => ({
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '16px',
      minHeight: '44px',
      padding: '10px 16px',
      '&:hover': {
        backgroundColor: '#e5f1fb',
      },
      '&.Mui-selected': {
        backgroundColor: '#e5f1fb',
        '&:hover': {
          backgroundColor: '#d0e7f5',
        },
      },
    }),
    []
  );

  const inputLabelSx = useMemo(
    () => ({
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '16px',
      color: '#000',
    }),
    []
  );

  const autocompleteTextFieldSx = useMemo(
    () => ({
      '& .MuiOutlinedInput-root': {
        minHeight: '44px',
        borderRadius: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        backgroundColor: '#fff',
        '& input': {
          padding: '10px 14px',
        },
        '& fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
        '&:hover fieldset': {
          borderColor: '#000',
        },
        '&.Mui-focused fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
      },
      '& .MuiInputLabel-root': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
        transform: 'translate(14px, 12px) scale(1)',
        '&.MuiInputLabel-shrink': {
          transform: 'translate(14px, -9px) scale(0.75)',
        },
        '&.Mui-focused': {
          color: '#000',
        },
      },
      '& .MuiInputBase-input': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
      },
    }),
    []
  );

  // Memoize the fields rendering to avoid unnecessary re-renders
  const renderedFields = useMemo(() => {
    return fields.map((field, index) => {
      // Generate stable key - prefer label, fallback to index
      const fieldKey = field.label || `field-${index}`;
      const gridSizes = getGridSizes(field);

      if (field.type === 'text') {
        return (
          <Grid key={fieldKey} item {...gridSizes}>
            <TextField
              fullWidth
              size="small"
              label={field.label}
              placeholder={field.placeholder}
              value={field.value || ''}
              onChange={(e) => field.onChange(e.target.value)}
              type="text"
              sx={fieldTextFieldSx}
            />
          </Grid>
        );
      }

      if (field.type === 'date') {
        return (
          <Grid key={fieldKey} item {...gridSizes}>
            <DatePicker
              label={field.label}
              value={(field.value as Date | null) || null}
              onChange={(newValue) => field.onChange(newValue)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  size: 'small',
                  sx: fieldTextFieldSx,
                },
              }}
            />
          </Grid>
        );
      }

      if (field.type === 'number') {
        return (
          <Grid key={fieldKey} item {...gridSizes}>
            <TextField
              fullWidth
              size="small"
              label={field.label}
              type="number"
              value={field.value || ''}
              onChange={(e) => {
                const value = e.target.value;
                field.onChange(value ? parseFloat(value) : undefined);
              }}
              placeholder={field.placeholder}
              sx={fieldTextFieldSx}
            />
          </Grid>
        );
      }

      if (field.type === 'select') {
        return (
          <Grid key={fieldKey} item {...gridSizes}>
            <FormControl fullWidth size="small" sx={selectSx}>
              <InputLabel sx={inputLabelSx}>
                {field.label}
              </InputLabel>
              <Select
                value={(field.value as string) || ''}
                label={field.label}
                onChange={(e: SelectChangeEvent) => field.onChange(e.target.value)}
                sx={selectSx}
              >
                {field.options?.map((option, optIndex) => (
                  <MenuItem 
                    key={String(option.value) || optIndex} 
                    value={option.value as string}
                    sx={menuItemSx}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        );
      }

      if (field.type === 'autocomplete') {
        // Create render input function - memoized per field
        const renderInput = field.renderInput || ((params: unknown) => {
          const autocompleteParams = params as {
            InputLabelProps?: Record<string, unknown>;
            InputProps?: {
              endAdornment?: React.ReactNode;
            };
          } & React.ComponentProps<typeof TextField>;
          return (
            <TextField
              {...autocompleteParams}
              label={field.label}
              placeholder={field.placeholder}
              size="small"
              fullWidth
              InputLabelProps={{
                ...autocompleteParams.InputLabelProps,
                shrink: false,
              }}
              InputProps={{
                ...autocompleteParams.InputProps,
                endAdornment: (
                  <>
                    {field.loading ? <CircularProgress color="inherit" size={24} /> : null}
                    {autocompleteParams.InputProps?.endAdornment}
                  </>
                ),
              }}
              sx={autocompleteTextFieldSx}
            />
          );
        });

        return (
          <Grid key={fieldKey} item {...gridSizes}>
            <Autocomplete
              fullWidth
              options={field.autocompleteOptions || []}
              value={field.value || null}
              onChange={(_, newValue) => field.onChange(newValue)}
              onInputChange={(_, newInputValue) => {
                if (field.onInputChange) {
                  field.onInputChange(newInputValue);
                }
              }}
              onOpen={() => {
                if (field.onOpen) {
                  field.onOpen();
                }
              }}
              getOptionLabel={field.getOptionLabel || defaultGetOptionLabel}
              isOptionEqualToValue={field.isOptionEqualToValue || defaultIsOptionEqualToValue}
              loading={field.loading}
              clearOnBlur={false}
              renderInput={renderInput}
              ListboxProps={field.ListboxProps}
              noOptionsText={field.noOptionsText || 'No options'}
            />
          </Grid>
        );
      }

      return null;
    });
  }, [fields, getGridSizes, fieldTextFieldSx, selectSx, menuItemSx, inputLabelSx, autocompleteTextFieldSx]);

  // Memoize style objects for desktop UI
  const paperSx = useMemo(
    () => ({
      padding: '20px',
      marginBottom: '16px',
      borderRadius: 0,
      boxShadow: 'none',
      border: '1px solid #c0c0c0',
      backgroundColor: '#fff',
    }),
    []
  );

  const headerBoxSx = useMemo(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      marginBottom: '16px',
      paddingBottom: '12px',
      borderBottom: '1px solid #d0d0d0',
    }),
    []
  );

  const headerTypographySx = useMemo(
    () => ({
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#000',
      fontWeight: 500,
      margin: 0,
    }),
    []
  );

  const searchIconSx = useMemo(
    () => ({
      marginRight: '8px',
      color: '#000',
      fontSize: '20px',
    }),
    []
  );

  const filterListIconSx = useMemo(
    () => ({
      color: '#000',
      fontSize: '20px',
    }),
    []
  );

  const textFieldSx = useMemo(
    () => ({
      '& .MuiOutlinedInput-root': {
        borderRadius: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        minHeight: '44px',
        backgroundColor: '#fff',
        '& input': {
          padding: '10px 14px',
        },
        '& fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
        '&:hover fieldset': {
          borderColor: '#000',
        },
        '&.Mui-focused fieldset': {
          borderColor: '#000',
          borderWidth: '1px',
        },
      },
      '& .MuiInputLabel-root': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
        '&.Mui-focused': {
          color: '#000',
        },
      },
      '& .MuiInputBase-input': {
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: '16px',
        color: '#000',
      },
    }),
    []
  );

  const buttonSx = useMemo(
    () => ({
      fontSize: '16px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      textTransform: 'none',
      borderRadius: 0,
      borderColor: '#c0c0c0',
      color: '#1a237e',
      padding: '8px 20px',
      minHeight: '44px',
      '&:hover': {
        borderColor: '#1a237e',
        backgroundColor: '#f5f5f5',
      },
      '&:disabled': {
        borderColor: '#e0e0e0',
        color: '#9e9e9e',
      },
    }),
    []
  );

  const buttonContainerSx = useMemo(
    () => ({
      display: 'flex',
      justifyContent: { xs: 'stretch', sm: 'flex-end', md: 'flex-end' },
    }),
    []
  );

  const buttonContainerFullSx = useMemo(
    () => ({
      display: 'flex',
      justifyContent: 'flex-end',
    }),
    []
  );

  const hasSearch = !!onSearchChange;

  return (
    <Paper sx={paperSx}>
      {showHeader && (
        <Box sx={headerBoxSx}>
          <FilterList sx={filterListIconSx} />
          <Typography sx={headerTypographySx}>Filters</Typography>
        </Box>
      )}
      <Grid container spacing={2} alignItems="center">
        {/* Search field and Clear Filters Button row */}
        {hasSearch && (
          <>
            <Grid item xs={12} sm={8} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder={searchPlaceholder}
                value={searchValue || ''}
                onChange={handleSearchChange}
                sx={textFieldSx}
                InputProps={{
                  startAdornment: <Search sx={searchIconSx} />,
                }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={8} sx={buttonContainerSx}>
              <Button variant="outlined" onClick={handleClear} sx={buttonSx}>
                {clearButtonText}
              </Button>
            </Grid>
          </>
        )}

        {/* Filter fields */}
        {renderedFields}

        {/* Clear Filters Button - only shown when there's no search field */}
        {!hasSearch && (
          <Grid item xs={12} sm={12} md={12} sx={buttonContainerFullSx}>
            <Button variant="outlined" onClick={handleClear} sx={buttonSx}>
              {clearButtonText}
            </Button>
          </Grid>
        )}
      </Grid>
    </Paper>
  );
};
/* eslint-enable react/prop-types */

FilterHeader.displayName = 'FilterHeader';

export default memo(FilterHeader);

