import { Box, Button, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import ChatAccidente from '../accidentes/ChatAccidente.tsx'
import AppHeader from '../components/AppHeader.tsx'
import BotonLlamar911 from '../components/BotonLlamar911.tsx'
import DatosPersonales from '../components/DatosPersonales.tsx'
import { useAppSelector } from '../store/index.ts'

// Disposición de references/ui/pantalla inicio.png. El asegurado ve tres
// columnas (datos personales, botón 911 y chat); el asegurador, sin chat, dos
function HomePage() {
  const perfil = useAppSelector((state) => state.auth.perfil)
  const navigate = useNavigate()

  if (!perfil) return null

  const esAsegurado = perfil.rol === 'asegurado'

  return (
    <>
      <AppHeader />
      <Box
        sx={{
          maxWidth: esAsegurado ? 1200 : 960,
          mx: 'auto',
          p: { xs: 2, md: 4 },
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: esAsegurado ? '280px 1fr 380px' : '320px 1fr',
          },
          gap: { xs: 3, md: 4 },
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
        {/* En la maqueta el chat arranca un poco más abajo que el botón 911 */}
        {esAsegurado && (
          <Box sx={{ mt: { md: 6 }, height: { xs: 480, md: 560 } }}>
            <ChatAccidente />
          </Box>
        )}
      </Box>
    </>
  )
}

export default HomePage
