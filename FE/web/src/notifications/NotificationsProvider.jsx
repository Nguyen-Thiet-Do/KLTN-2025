// src/notifications/NotificationsProvider.jsx
import { SnackbarProvider, closeSnackbar } from 'notistack';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

export default function NotificationsProvider({ children }) {
  
  window.__closeSnackbar = (id) => closeSnackbar(id);

  return (
    <SnackbarProvider
      maxSnack={4}
      anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      autoHideDuration={2600}
      preventDuplicate
      variant="info"
      action={(snackbarId) => (
        <IconButton size="small" onClick={() => closeSnackbar(snackbarId)}>
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    >
      {children}
    </SnackbarProvider>
  );
}
