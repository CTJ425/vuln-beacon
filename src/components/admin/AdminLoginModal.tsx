import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Alert,
  Box,
  CircularProgress,
  IconButton,
} from '@mui/material';
import { ShieldCheck, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface AdminLoginModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (user?: any) => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({ open, onClose, onSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!email || !password) {
      setErrorMessage('請輸入帳號與密碼 (Please enter email and password)');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage(error.message || '登入失敗，請確認帳號密碼');
        return;
      }

      if (data?.session) {
        const loggedInUser = (data as any)?.user || data.session?.user || { email: email.trim() };
        setEmail('');
        setPassword('');
        onSuccess(loggedInUser);
      } else if (data?.user) {
        setErrorMessage('登入未完成，帳號可能需要先完成信箱驗證 (Email confirmation required)。');
      } else {
        setErrorMessage('登入失敗，未能建立有效連線 Session。');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || '發生未預期的驗證錯誤');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          borderRadius: 3,
          boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
        },
      }}
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: 1,
            borderColor: 'divider',
            pb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ p: 1, bgcolor: 'primary.main', color: 'primary.contrastText', borderRadius: 1.5 }}>
              <ShieldCheck size={20} />
            </Box>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                後台系統身分驗證
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Supabase Authentication
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <X size={18} />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            請輸入管理員帳號與密碼以進入後台系統進行設定與日誌排錯。
          </Typography>

          {errorMessage && (
            <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setErrorMessage(null)}>
              {errorMessage}
            </Alert>
          )}

          <TextField
            label="Email / 管理員信箱"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
            required
            autoFocus
            disabled={isLoading}
            size="small"
          />

          <TextField
            label="Password / 密碼"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
            required
            disabled={isLoading}
            size="small"
          />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button onClick={onClose} disabled={isLoading} sx={{ color: 'text.secondary' }}>
            取消
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={isLoading}
            onClick={handleSubmit}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : null}
            sx={{ fontWeight: 700, px: 2.5 }}
          >
            {isLoading ? '驗證中...' : '登入後台'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};
