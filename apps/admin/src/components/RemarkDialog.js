import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { FiMessageSquare, FiUser, FiClock } from 'react-icons/fi';

const RemarkDialog = ({ 
  open, 
  onClose, 
  loan, 
  onRemarkAdded,
  collectionType = 'pre-collection' // 'pre-collection' or 'collection'
}) => {
  const [remark, setRemark] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('no_payment');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!remark.trim()) {
      setError('Please enter a remark');
      return;
    }

    if (paymentStatus === 'partial_payment' && (!paymentAmount || parseFloat(paymentAmount) <= 0)) {
      setError('Please enter a valid payment amount for partial payment');
      return;
    }

    if (paymentStatus === 'full_payment' && paymentAmount && parseFloat(paymentAmount) !== loan.totalAmount) {
      setError('Full payment amount must equal the total loan amount');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const loanId = loan?.id || loan?._id || loan?.loanId;
      const remarkType = collectionType === 'pre-collection' ? 'precollection' : 'collection';

      if (!loanId) {
        throw new Error('Loan ID is missing for this remark');
      }

      const response = await fetch(`/api/loans/${loanId}/add-remark`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
        },
        body: JSON.stringify({
          remark: remark.trim(),
          remarkType,
          paymentStatus,
          paymentAmount: paymentAmount ? parseFloat(paymentAmount) : 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to add remark');
      }

      const data = await response.json();
      
      // Call the callback to refresh the parent component
      if (onRemarkAdded) {
        onRemarkAdded(data.loan);
      }

      // Reset form and close dialog
      setRemark('');
      setPaymentStatus('no_payment');
      setPaymentAmount('');
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setRemark('');
      setPaymentStatus('no_payment');
      setPaymentAmount('');
      setError('');
      onClose();
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-GH', {
      style: 'currency',
      currency: 'GHS'
    }).format(amount);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_assign': return 'warning';
      case 'assigned': return 'info';
      case 'hanged_up': return 'error';
      case 'completed': return 'success';
      case 'processed': return 'primary';
      default: return 'default';
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <FiMessageSquare />
          <Typography variant="h6">
            Add Remark - {collectionType === 'pre-collection' ? 'Pre-Collection' : 'Collection'}
          </Typography>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {loan && (
          <Box mb={3}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Loan Details
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={2} mb={2}>
              <Box>
                <Typography variant="body2" color="textSecondary">User ID</Typography>
                <Typography variant="body2" fontWeight="medium">{loan.userId}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Product Name</Typography>
                <Typography variant="body2" fontWeight="medium">{loan.productName}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Total Amount</Typography>
                <Typography variant="body2" fontWeight="medium">{formatCurrency(loan.totalAmount)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">Status</Typography>
                <Chip 
                  label={loan.status?.replace('_', ' ').toUpperCase()} 
                  color={getStatusColor(loan.status)}
                  size="small"
                />
              </Box>
            </Box>
            
            {loan.assignedOfficer && (
              <Box display="flex" alignItems="center" gap={1} mb={2}>
                <FiUser size={16} />
                <Typography variant="body2">
                  <strong>Assigned Officer:</strong> {loan.assignedOfficer.name} ({loan.assignedOfficer.email})
                </Typography>
              </Box>
            )}

            {loan.remarks && loan.remarks.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>Previous Remarks:</Typography>
                <Box maxHeight={150} overflow="auto">
                  {loan.remarks.map((remarkItem, index) => (
                    <Box key={index} mb={1} p={1} bgcolor="grey.50" borderRadius={1}>
                      <Typography variant="body2">{remarkItem.text}</Typography>
                      <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                        <FiClock size={12} />
                        <Typography variant="caption" color="textSecondary">
                          {new Date(remarkItem.timestamp).toLocaleString()} by {remarkItem.officerName}
                        </Typography>
                      </Box>
                      {remarkItem.paymentStatus !== 'no_payment' && (
                        <Typography variant="caption" color="primary">
                          Payment: {remarkItem.paymentStatus.replace('_', ' ')} 
                          {remarkItem.paymentAmount > 0 && `- ${formatCurrency(remarkItem.paymentAmount)}`}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box mb={2}>
          <TextField
            label="Remark"
            multiline
            rows={4}
            fullWidth
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Enter your remark about this case..."
            disabled={loading}
            required
          />
        </Box>

        <Box mb={2}>
          <FormControl fullWidth>
            <InputLabel>Payment Status</InputLabel>
            <Select
              value={paymentStatus}
              label="Payment Status"
              onChange={(e) => {
                setPaymentStatus(e.target.value);
                if (e.target.value === 'full_payment' && loan) {
                  setPaymentAmount(loan.totalAmount.toString());
                } else if (e.target.value === 'no_payment') {
                  setPaymentAmount('');
                }
              }}
              disabled={loading}
            >
              <MenuItem value="no_payment">No Payment</MenuItem>
              <MenuItem value="partial_payment">Partial Payment</MenuItem>
              <MenuItem value="full_payment">Full Payment</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {(paymentStatus === 'partial_payment' || paymentStatus === 'full_payment') && (
          <Box mb={2}>
            <TextField
              label="Payment Amount"
              type="number"
              fullWidth
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              placeholder="Enter payment amount"
              disabled={loading || paymentStatus === 'full_payment'}
              required
              inputProps={{
                min: 0,
                max: loan?.totalAmount,
                step: 0.01
              }}
              helperText={paymentStatus === 'full_payment' ? 
                `Full payment amount: ${loan ? formatCurrency(loan.totalAmount) : ''}` : 
                `Maximum amount: ${loan ? formatCurrency(loan.totalAmount) : ''}`
              }
            />
          </Box>
        )}

        <Box bgcolor="info.light" p={2} borderRadius={1}>
          <Typography variant="body2" color="info.dark">
            <strong>Note:</strong> Adding a remark will move this case to the "Processed" tab and 
            contribute to your performance metrics. Make sure to provide detailed and accurate information.
          </Typography>
        </Box>
      </DialogContent>
      
      <DialogActions>
        <Button 
          onClick={handleClose} 
          disabled={loading}
          color="inherit"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={loading || !remark.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : <FiMessageSquare />}
        >
          {loading ? 'Adding Remark...' : 'Add Remark'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RemarkDialog;