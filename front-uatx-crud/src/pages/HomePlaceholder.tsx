import { Box, Typography } from '@mui/material'
import AppHeader from '../components/AppHeader.tsx'
import { useAppSelector } from '../store/index.ts'

// Placeholder: la pantalla de inicio completa llega en el paso 7 de la SPEC 02
function HomePlaceholder() {
  const perfil = useAppSelector((state) => state.auth.perfil)

  return (
    <>
      <AppHeader />
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <Typography variant="h4" component="h2">
          Bienvenido, {perfil?.nombre}
        </Typography>
      </Box>
    </>
  )
}

export default HomePlaceholder
