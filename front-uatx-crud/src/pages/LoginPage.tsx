import { useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { login, LoginError } from '../auth/api.ts'
import { useAppDispatch, useAppSelector } from '../store/index.ts'
import { iniciarSesion } from '../store/authSlice.ts'

function LoginPage() {
  const dispatch = useAppDispatch()
  // Aviso al llegar desde una sesión expirada (lo pone useSesionExpirada)
  const aviso = useAppSelector((state) => state.auth.avisoLogin)
  const [identificador, setIdentificador] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      const sesion = await login(identificador.trim(), contrasena)
      dispatch(iniciarSesion(sesion))
    } catch (err) {
      setError(
        err instanceof LoginError ? err.message : 'Ocurrió un error inesperado',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 2,
      }}
    >
      <Paper
        component="form"
        onSubmit={handleSubmit}
        noValidate
        variant="outlined"
        sx={{ width: '100%', maxWidth: 480, p: { xs: 3, sm: 5 } }}
      >
        <Typography variant="h5" component="h1" sx={{ mb: 5 }}>
          Login
        </Typography>

        <Stack spacing={4}>
          <TextField
            label="Correo o idUsuario"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            fullWidth
          />
          <TextField
            label="Contraseña"
            type="password"
            value={contrasena}
            onChange={(e) => setContrasena(e.target.value)}
            autoComplete="current-password"
            required
            fullWidth
          />

          {error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            aviso && <Alert severity="warning">{aviso}</Alert>
          )}

          <Box>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={enviando || !identificador.trim() || !contrasena}
              sx={{ borderRadius: 6, px: 6, textTransform: 'none' }}
            >
              {enviando ? 'Ingresando…' : 'Aceptar'}
            </Button>
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}

export default LoginPage
