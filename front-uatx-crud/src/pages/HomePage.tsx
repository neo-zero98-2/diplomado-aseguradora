import { Box, Button, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader.tsx'
import BotonLlamar911 from '../components/BotonLlamar911.tsx'
import DatosPersonales from '../components/DatosPersonales.tsx'
import { useAppSelector } from '../store/index.ts'

// Disposición de references/ui/pantalla inicio.png, sin el panel de chat (SPEC 03)
function HomePage() {
  const perfil = useAppSelector((state) => state.auth.perfil)
  const navigate = useNavigate()

  if (!perfil) return null

  return (
    <>
      <AppHeader />
      <Box
        sx={{
          maxWidth: 960,
          mx: 'auto',
          p: { xs: 2, md: 4 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
          gap: { xs: 3, md: 6 },
          alignItems: 'start',
        }}
      >
        <DatosPersonales perfil={perfil} />
        <Stack spacing={2} sx={{ maxWidth: { md: 360 } }}>
          <BotonLlamar911 />
          {perfil.rol === 'asegurador' && (
            <Button
              variant="outlined"
              size="large"
              onClick={() => navigate('/asegurados')}
            >
              Administrar asegurados
            </Button>
          )}
        </Stack>
      </Box>
    </>
  )
}

export default HomePage
