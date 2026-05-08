import React, { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  InputAdornment,
  Chip,
  IconButton,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  Wifi,
  WifiOff
} from '@mui/icons-material';
import { useRealtime } from '../hooks/useRealtime';

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'approved':
    case 'completed':
    case 'success':
      return 'success';
    case 'pending':
    case 'under-review':
      return 'warning';
    case 'rejected':
    case 'failed':
    case 'cancelled':
      return 'error';
    case 'disbursed':
      return 'info';
    default:
      return 'default';
  }
};

const RealTimeDataTable = ({ 
  type = 'loans', // 'loans', 'users', 'payments'
  title,
  columns = [],
  onRowClick,
  filters = {},
  searchFields = [],
  refreshInterval = 30000 // 30 seconds
}) => {
  const {
    connected,
    loanData,
    userData,
    requestLoanData,
    requestUserData,
    performSearch,
    clearSearch
  } = useRealtime();
  
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState('');
  const [localFilters, setLocalFilters] = useState(filters);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  // Get data based on type
  const getData = () => {
    switch (type) {
      case 'loans':
        return loanData;
      case 'users':
        return userData;
      default:
        return null;
    }
  };

  const data = getData();
  const rows = data?.loans || data?.users || [];
  const totalCount = data?.pagination?.total || rows.length;

  // Request data based on type
  const requestData = (additionalFilters = {}) => {
    const requestFilters = {
      page: page + 1,
      limit: rowsPerPage,
      search: searchQuery,
      ...localFilters,
      ...additionalFilters
    };

    switch (type) {
      case 'loans':
        requestLoanData(requestFilters);
        break;
      case 'users':
        requestUserData(requestFilters);
        break;
      default:
        break;
    }
  };

  // Initial data load
  useEffect(() => {
    if (connected) {
      requestData();
    }
  }, [connected, page, rowsPerPage, localFilters]);

  // Update loading state when data changes
  useEffect(() => {
    if (data) {
      setLoading(false);
      setLastUpdate(new Date());
    }
  }, [data]);

  // Auto-refresh data
  useEffect(() => {
    if (!connected || refreshInterval <= 0) return;
    
    const interval = setInterval(() => {
      requestData();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [connected, refreshInterval, page, rowsPerPage, localFilters]);

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.length >= 2) {
        performSearch(searchQuery, type);
      } else if (searchQuery.length === 0) {
        clearSearch();
        requestData();
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleFilterChange = (filterKey, value) => {
    setLocalFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
    setPage(0);
  };

  const handleRefresh = () => {
    setLoading(true);
    requestData();
  };

  const renderCellValue = (row, column) => {
    const value = column.accessor.split('.').reduce((obj, key) => obj?.[key], row);
    
    if (column.type === 'status') {
      return (
        <Chip
          label={value}
          color={getStatusColor(value)}
          size="small"
          variant="outlined"
        />
      );
    }
    
    if (column.type === 'currency') {
      return `₵${Number(value || 0).toLocaleString()}`;
    }
    
    if (column.type === 'date') {
      return value ? new Date(value).toLocaleDateString() : '-';
    }
    
    if (column.type === 'boolean') {
      return (
        <Chip
          label={value ? 'Yes' : 'No'}
          color={value ? 'success' : 'default'}
          size="small"
          variant="outlined"
        />
      );
    }
    
    return value || '-';
  };

  return (
    <div className="max-w-7xl mx-auto p-4">
    <Paper sx={{ width: '100%', mb: 2 }} className="shadow rounded-lg">
      {/* Header */}
      <Box p={2} display="flex" alignItems="center" justifyContent="space-between">
        <Box>
          <Typography variant="h6">
            {title}
          </Typography>
          {lastUpdate && (
            <Typography variant="caption" color="textSecondary">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Typography>
          )}
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Chip
            icon={connected ? <Wifi /> : <WifiOff />}
            label={connected ? 'Live' : 'Offline'}
            color={connected ? 'success' : 'error'}
            size="small"
            variant="outlined"
          />
          <Tooltip title="Refresh Data">
            <IconButton onClick={handleRefresh} disabled={!connected}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Connection Alert */}
      {!connected && (
        <Alert severity="warning" sx={{ mx: 2, mb: 2 }}>
          Real-time connection lost. Data may not be current.
        </Alert>
      )}

      {/* Search and Filters */}
      <Box p={2} display="flex" gap={2} alignItems="center" flexWrap="wrap">
        <TextField
          placeholder={`Search ${type}...`}
          value={searchQuery}
          onChange={handleSearchChange}
          size="small"
          sx={{ minWidth: 250 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
        
        {/* Status Filter */}
        {type === 'loans' && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={localFilters.status || ''}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="under-review">Under Review</MenuItem>
              <MenuItem value="approved">Approved</MenuItem>
              <MenuItem value="rejected">Rejected</MenuItem>
              <MenuItem value="disbursed">Disbursed</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
            </Select>
          </FormControl>
        )}
        
        {type === 'users' && (
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={localFilters.status || ''}
              label="Status"
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>

      {/* Data Table */}
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell key={column.id} sx={{ fontWeight: 'bold' }}>
                  {column.label}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <CircularProgress />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    No {type} found
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow
                  key={row._id || index}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((column) => (
                    <TableCell key={column.id}>
                      {renderCellValue(row, column)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        rowsPerPageOptions={[10, 25, 50, 100]}
        component="div"
        count={totalCount}
        rowsPerPage={rowsPerPage}
        page={page}
        onPageChange={handleChangePage}
        onRowsPerPageChange={handleChangeRowsPerPage}
      />
    </Paper>
    </div>
  );
};

export default RealTimeDataTable;
