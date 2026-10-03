import { AppBar, Box, Button, Toolbar, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch } from '../store/index.ts'
import { cerrarSesion } from '../store/authSlice.ts'

function AppHeader() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()

  // El store borra la clave de localStorage al quedar sin accessToken
  function handleCerrarSesion() {
    dispatch(cerrarSesion())
    navigate('/login', { replace: true })
  }

  return (
    <AppBar position="static">
      <Toolbar>
        {/* Espaciador simétrico al del botón para centrar el título; en móvil
            no hay espacio y el título se alinea a la izquierda */}
        <Box sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} />
        <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
          Aseguradora
        </Typography>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            color="inherit"
            onClick={handleCerrarSesion}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Cerrar sesión
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default AppHeader
