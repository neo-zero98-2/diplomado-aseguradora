import { Box, Typography } from '@mui/material'
import { useAppSelector } from '../store/index.ts'

// Placeholder: la pantalla de inicio completa es la SPEC 02
function HomePlaceholder() {
  const perfil = useAppSelector((state) => state.auth.perfil)

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
      <Typography variant="h4" component="h1">
        Bienvenido, {perfil?.nombre}
      </Typography>
    </Box>
  )
}

export default HomePlaceholder
