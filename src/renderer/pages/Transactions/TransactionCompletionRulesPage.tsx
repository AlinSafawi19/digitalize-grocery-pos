import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import MainLayout from '../../components/layout/MainLayout';
import { useToast } from '../../hooks/useToast';
import Toast from '../../components/common/Toast';
import {
  TransactionCompletionRuleService,
  TransactionCompletionRule,
  CreateRuleInput,
  UpdateRuleInput,
  RuleCondition,
  RuleAction,
  ConditionOperator,
  RuleActionType,
} from '../../services/transaction-completion-rule.service';

const CONDITION_FIELDS = [
  { value: 'total', label: 'Total Amount' },
  { value: 'itemCount', label: 'Item Count' },
  { value: 'type', label: 'Transaction Type' },
  { value: 'status', label: 'Status' },
  { value: 'cashierId', label: 'Cashier ID' },
  { value: 'hasItems', label: 'Has Items' },
  { value: 'hasPayments', label: 'Has Payments' },
  { value: 'isFullyPaid', label: 'Is Fully Paid' },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_or_equal', label: 'Greater or Equal' },
  { value: 'less_or_equal', label: 'Less or Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'in', label: 'In' },
  { value: 'not_in', label: 'Not In' },
];

const ACTION_TYPES: { value: RuleActionType; label: string }[] = [
  { value: 'complete_transaction', label: 'Complete Transaction' },
  { value: 'add_note', label: 'Add Note' },
  { value: 'set_status', label: 'Set Status' },
];

export default function TransactionCompletionRulesPage() {
  const { user } = useSelector((state: RootState) => state.auth);
  const { toast, showToast, hideToast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<TransactionCompletionRule[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<TransactionCompletionRule | null>(null);
  
  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [conditions, setConditions] = useState<RuleCondition[]>([]);
  const [actions, setActions] = useState<RuleAction[]>([]);

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const result = await TransactionCompletionRuleService.getAllRules();
      if (result.success) {
        setRules(result.rules);
      } else {
        showToast(result.error || 'Failed to load rules', 'error');
      }
    } catch (err) {
      console.error('Error loading rules:', err);
      showToast('Failed to load rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const handleOpenDialog = (rule?: TransactionCompletionRule) => {
    if (rule) {
      setEditingRule(rule);
      setName(rule.name);
      setDescription(rule.description || '');
      setIsActive(rule.isActive);
      setPriority(rule.priority);
      setConditions(rule.conditions);
      setActions(rule.actions);
    } else {
      setEditingRule(null);
      setName('');
      setDescription('');
      setIsActive(true);
      setPriority(0);
      setConditions([]);
      setActions([]);
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingRule(null);
    setName('');
    setDescription('');
    setIsActive(true);
    setPriority(0);
    setConditions([]);
    setActions([]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Rule name is required', 'error');
      return;
    }

    if (conditions.length === 0) {
      showToast('At least one condition is required', 'error');
      return;
    }

    if (actions.length === 0) {
      showToast('At least one action is required', 'error');
      return;
    }

    if (!user?.id) {
      showToast('User not found', 'error');
      return;
    }

    try {
      if (editingRule) {
        const input: UpdateRuleInput = {
          name,
          description: description || undefined,
          isActive,
          priority,
          conditions,
          actions,
        };
        const result = await TransactionCompletionRuleService.updateRule(editingRule.id, input);
        if (result.success) {
          showToast('Rule updated successfully', 'success');
          handleCloseDialog();
          await loadRules();
        } else {
          showToast(result.error || 'Failed to update rule', 'error');
        }
      } else {
        const input: CreateRuleInput = {
          name,
          description: description || undefined,
          isActive,
          priority,
          conditions,
          actions,
        };
        const result = await TransactionCompletionRuleService.createRule(input, user.id);
        if (result.success) {
          showToast('Rule created successfully', 'success');
          handleCloseDialog();
          await loadRules();
        } else {
          showToast(result.error || 'Failed to create rule', 'error');
        }
      }
    } catch (err) {
      console.error('Error saving rule:', err);
      showToast('Failed to save rule', 'error');
    }
  };

  const handleDelete = async (ruleId: number) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) {
      return;
    }

    try {
      const result = await TransactionCompletionRuleService.deleteRule(ruleId);
      if (result.success) {
        showToast('Rule deleted successfully', 'success');
        await loadRules();
      } else {
        showToast(result.error || 'Failed to delete rule', 'error');
      }
    } catch (err) {
      console.error('Error deleting rule:', err);
      showToast('Failed to delete rule', 'error');
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'total', operator: 'equals', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, field: Partial<RuleCondition>) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], ...field };
    setConditions(updated);
  };

  const addAction = () => {
    setActions([...actions, { type: 'complete_transaction', params: {} }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, field: Partial<RuleAction>) => {
    const updated = [...actions];
    updated[index] = { ...updated[index], ...field };
    setActions(updated);
  };

  return (
    <MainLayout>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1">
            Transaction Completion Rules
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => handleOpenDialog()}
          >
            New Rule
          </Button>
        </Box>

        <Alert severity="info" sx={{ mb: 3 }}>
          Rules are evaluated automatically when transactions are created. Rules with higher priority are evaluated first.
        </Alert>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : rules.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body1" color="text.secondary">
              No rules configured. Create a rule to automatically complete transactions based on conditions.
            </Typography>
          </Paper>
        ) : (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Conditions</TableCell>
                  <TableCell>Actions</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight="bold">
                        {rule.name}
                      </Typography>
                      {rule.description && (
                        <Typography variant="caption" color="text.secondary">
                          {rule.description}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{rule.priority}</TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={rule.isActive ? 'Active' : 'Inactive'}
                        color={rule.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenDialog(rule)}>
                          <Edit />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete(rule.id)}>
                          <Delete />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Rule Dialog */}
        <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
          <DialogTitle>{editingRule ? 'Edit Rule' : 'New Rule'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Rule Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  label="Priority"
                  type="number"
                  value={priority}
                  onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                  helperText="Higher priority rules are evaluated first"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <FormControlLabel
                  control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
                  label="Active"
                />
              </Grid>

              {/* Conditions */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Conditions
                </Typography>
                {conditions.map((condition, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Field</InputLabel>
                          <Select
                            value={condition.field}
                            label="Field"
                            onChange={(e) => updateCondition(index, { field: e.target.value })}
                          >
                            {CONDITION_FIELDS.map((field) => (
                              <MenuItem key={field.value} value={field.value}>
                                {field.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Operator</InputLabel>
                          <Select
                            value={condition.operator}
                            label="Operator"
                            onChange={(e) => updateCondition(index, { operator: e.target.value as ConditionOperator })}
                          >
                            {CONDITION_OPERATORS.map((op) => (
                              <MenuItem key={op.value} value={op.value}>
                                {op.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} sm={4}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Value"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: e.target.value })}
                        />
                      </Grid>
                      <Grid item xs={12} sm={2}>
                        <IconButton color="error" onClick={() => removeCondition(index)}>
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                <Button startIcon={<Add />} onClick={addCondition} size="small">
                  Add Condition
                </Button>
              </Grid>

              {/* Actions */}
              <Grid item xs={12}>
                <Typography variant="h6" gutterBottom>
                  Actions
                </Typography>
                {actions.map((action, index) => (
                  <Paper key={index} sx={{ p: 2, mb: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={12} sm={4}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Action Type</InputLabel>
                          <Select
                            value={action.type}
                            label="Action Type"
                            onChange={(e) => updateAction(index, { type: e.target.value as RuleActionType })}
                          >
                            {ACTION_TYPES.map((type) => (
                              <MenuItem key={type.value} value={type.value}>
                                {type.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                      {action.type === 'add_note' && (
                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            size="small"
                            label="Note"
                            value={action.params?.note || ''}
                            onChange={(e) => updateAction(index, { params: { note: e.target.value } })}
                          />
                        </Grid>
                      )}
                      {action.type === 'set_status' && (
                        <Grid item xs={12} sm={6}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Status</InputLabel>
                            <Select
                              value={action.params?.status || 'pending'}
                              label="Status"
                              onChange={(e) => updateAction(index, { params: { status: e.target.value } })}
                            >
                              <MenuItem value="pending">Pending</MenuItem>
                              <MenuItem value="completed">Completed</MenuItem>
                              <MenuItem value="voided">Voided</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                      )}
                      <Grid item xs={12} sm={2}>
                        <IconButton color="error" onClick={() => removeAction(index)}>
                          <Delete />
                        </IconButton>
                      </Grid>
                    </Grid>
                  </Paper>
                ))}
                <Button startIcon={<Add />} onClick={addAction} size="small">
                  Add Action
                </Button>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button onClick={handleSave} variant="contained">
              {editingRule ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </Dialog>

        <Toast
          toast={toast}
          onClose={hideToast}
        />
      </Box>
    </MainLayout>
  );
}

