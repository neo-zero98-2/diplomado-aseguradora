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
        {/* Espaciador del mismo ancho que el botón para centrar el título */}
        <Box sx={{ flex: 1 }} />
        <Typography variant="h6" component="h1" sx={{ fontWeight: 'bold' }}>
          Aseguradora
        </Typography>
        <Box sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end' }}>
          <Button color="inherit" onClick={handleCerrarSesion}>
            Cerrar sesión
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default AppHeader
