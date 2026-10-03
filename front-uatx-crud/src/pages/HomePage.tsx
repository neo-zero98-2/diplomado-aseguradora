import { useState } from 'react'
import { Box, Button, Stack } from '@mui/material'
import { useNavigate } from 'react-router-dom'
import AccidentesTabla from '../accidentes/AccidentesTabla.tsx'
import ChatAccidente from '../accidentes/ChatAccidente.tsx'
import ChatFlotante from '../accidentes/ChatFlotante.tsx'
import MisAccidentesTabla from '../accidentes/MisAccidentesTabla.tsx'
import AppHeader from '../components/AppHeader.tsx'
import BotonLlamar911 from '../components/BotonLlamar911.tsx'
import DatosPersonales from '../components/DatosPersonales.tsx'
import { useAppSelector } from '../store/index.ts'

// Dos columnas para ambos roles: "Datos personales" a la izquierda y, a la
// derecha, los botones arriba y la tabla de accidentes debajo. El chat del
// asegurado es un botón flotante en la esquina inferior derecha
function HomePage() {
  const perfil = useAppSelector((state) => state.auth.perfil)
  const navigate = useNavigate()
  // Sube cada vez que el chat registra un accidente para recargar la tabla
  const [recargaMisAccidentes, setRecargaMisAccidentes] = useState(0)

  if (!perfil) return null

  const esAsegurado = perfil.rol === 'asegurado'

  return (
    <>
      <AppHeader />
      <Box
        sx={{
          maxWidth: 1280,
          mx: 'auto',
          p: { xs: 2, md: 4 },
          // Deja libre el alto del botón flotante para que no tape la tabla
          pb: esAsegurado ? 12 : { xs: 2, md: 4 },
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '320px 1fr' },
          gap: { xs: 3, md: 4 },
          alignItems: 'start',
        }}
      >
        <DatosPersonales perfil={perfil} />
        {/* minWidth 0 deja que la tabla haga scroll dentro de la columna */}
        <Stack spacing={3} sx={{ minWidth: 0 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            sx={{ maxWidth: { sm: 640 } }}
          >
            <Box sx={{ flex: 1 }}>
              <BotonLlamar911 />
            </Box>
            {perfil.rol === 'asegurador' && (
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/asegurados')}
                sx={{ flex: 1 }}
              >
                Administrar asegurados
              </Button>
            )}
          </Stack>
          {esAsegurado && (
            <MisAccidentesTabla recarga={recargaMisAccidentes} />
          )}
          {perfil.rol === 'asegurador' && <AccidentesTabla />}
        </Stack>
      </Box>
      {esAsegurado && (
        <ChatFlotante etiqueta="Chat con IA Gemini">
          {(accionCerrar) => (
            <ChatAccidente
              accionEncabezado={accionCerrar}
              onAccidenteRegistrado={() =>
                setRecargaMisAccidentes((n) => n + 1)
              }
            />
          )}
        </ChatFlotante>
      )}
    </>
  )
}

export default HomePage
