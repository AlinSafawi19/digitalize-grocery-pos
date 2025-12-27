import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Star,
  StarBorder,
  Email,
  Phone,
  Business,
} from '@mui/icons-material';
import { SupplierContactService, SupplierContact, CreateSupplierContactInput, UpdateSupplierContactInput } from '../../services/supplier-contact.service';
import { useToast } from '../../hooks/useToast';

interface SupplierContactListProps {
  supplierId: number;
  userId: number;
  onContactChange?: () => void;
}

const SupplierContactList: React.FC<SupplierContactListProps> = ({
  supplierId,
  userId,
  onContactChange,
}) => {
  const { showToast } = useToast();
  const [contacts, setContacts] = useState<SupplierContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<SupplierContact | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<SupplierContact | null>(null);

  // Form state
  const [formData, setFormData] = useState<CreateSupplierContactInput>({
    supplierId,
    name: '',
    email: '',
    phone: '',
    role: '',
    isPrimary: false,
    notes: '',
  });

  const loadContacts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await SupplierContactService.getContactsBySupplierId(supplierId);
      if (result.success && result.contacts) {
        setContacts(result.contacts);
      } else {
        showToast(result.error || 'Failed to load contacts', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  }, [supplierId, showToast]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  const handleOpenForm = (contact?: SupplierContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        supplierId,
        name: contact.name,
        email: contact.email || '',
        phone: contact.phone || '',
        role: contact.role || '',
        isPrimary: contact.isPrimary,
        notes: contact.notes || '',
      });
    } else {
      setEditingContact(null);
      setFormData({
        supplierId,
        name: '',
        email: '',
        phone: '',
        role: '',
        isPrimary: false,
        notes: '',
      });
    }
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingContact(null);
    setFormData({
      supplierId,
      name: '',
      email: '',
      phone: '',
      role: '',
      isPrimary: false,
      notes: '',
    });
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      showToast('Contact name is required', 'error');
      return;
    }

    try {
      if (editingContact) {
        const updateData: UpdateSupplierContactInput = {
          name: formData.name,
          email: formData.email || null,
          phone: formData.phone || null,
          role: formData.role || null,
          isPrimary: formData.isPrimary,
          notes: formData.notes || null,
        };
        const result = await SupplierContactService.updateContact(editingContact.id, updateData, userId);
        if (result.success) {
          showToast('Contact updated successfully', 'success');
          handleCloseForm();
          loadContacts();
          onContactChange?.();
        } else {
          showToast(result.error || 'Failed to update contact', 'error');
        }
      } else {
        const result = await SupplierContactService.createContact(formData, userId);
        if (result.success) {
          showToast('Contact created successfully', 'success');
          handleCloseForm();
          loadContacts();
          onContactChange?.();
        } else {
          showToast(result.error || 'Failed to create contact', 'error');
        }
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleSetPrimary = async (contactId: number) => {
    try {
      const result = await SupplierContactService.setPrimaryContact(contactId, userId);
      if (result.success) {
        showToast('Primary contact updated', 'success');
        loadContacts();
        onContactChange?.();
      } else {
        showToast(result.error || 'Failed to set primary contact', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  const handleDeleteClick = (contact: SupplierContact) => {
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!contactToDelete) return;

    try {
      const result = await SupplierContactService.deleteContact(contactToDelete.id, userId);
      if (result.success) {
        showToast('Contact deleted successfully', 'success');
        setDeleteDialogOpen(false);
        setContactToDelete(null);
        loadContacts();
        onContactChange?.();
      } else {
        showToast(result.error || 'Failed to delete contact', 'error');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'An error occurred', 'error');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Contact Persons</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenForm()}
        >
          Add Contact
        </Button>
      </Box>

      {contacts.length === 0 ? (
        <Alert severity="info">No contacts found. Add a contact person to get started.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Phone</TableCell>
                <TableCell>Primary</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {contacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight="medium">
                        {contact.name}
                      </Typography>
                      {contact.isPrimary && (
                        <Chip
                          label="Primary"
                          size="small"
                          color="primary"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {contact.role ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Business sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{contact.role}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.email ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Email sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{contact.email}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.phone ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Phone sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">{contact.phone}</Typography>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">-</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Tooltip title={contact.isPrimary ? 'Primary contact' : 'Set as primary'}>
                      <IconButton
                        size="small"
                        onClick={() => handleSetPrimary(contact.id)}
                        color={contact.isPrimary ? 'primary' : 'default'}
                      >
                        {contact.isPrimary ? <Star /> : <StarBorder />}
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small"
                      onClick={() => handleOpenForm(contact)}
                      color="primary"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteClick(contact)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Contact Form Dialog */}
      <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingContact ? 'Edit Contact' : 'Add Contact'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              fullWidth
            />
            <TextField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              fullWidth
            />
            <TextField
              label="Role"
              placeholder="e.g., Sales Manager, Account Manager"
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              fullWidth
            />
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              fullWidth
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                />
              }
              label="Set as primary contact"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseForm}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingContact ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Contact</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {contactToDelete?.name}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SupplierContactList;

