import { useState } from 'react'
import { Box, Fab, IconButton, SvgIcon, Tooltip } from '@mui/material'
import ChatAccidente from './ChatAccidente.tsx'

function IconoChat() {
  return (
    <SvgIcon>
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-2 12H6v-2h12zm0-3H6V9h12zm0-3H6V6h12z" />
    </SvgIcon>
  )
}

function IconoCerrar() {
  return (
    <SvgIcon fontSize="small">
      <path d="M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </SvgIcon>
  )
}

interface ChatFlotanteProps {
  onAccidenteRegistrado?: () => void
}

// Botón flotante en la esquina inferior derecha que abre el chat de Gemini.
// Cerrar solo oculta el panel: ChatAccidente sigue montado y la conversación,
// la foto y su constancia se conservan hasta recargar la página
function ChatFlotante({ onAccidenteRegistrado }: ChatFlotanteProps) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {!abierto && (
        <Tooltip title="Chat con IA Gemini" placement="left">
          <Fab
            color="primary"
            aria-label="Abrir chat con IA Gemini"
            onClick={() => setAbierto(true)}
            sx={{ position: 'fixed', right: 24, bottom: 24 }}
          >
            <IconoChat />
          </Fab>
        </Tooltip>
      )}

      <Box
        role="dialog"
        aria-label="Chat con IA Gemini"
        aria-hidden={!abierto}
        sx={{
          display: abierto ? 'block' : 'none',
          position: 'fixed',
          zIndex: (theme) => theme.zIndex.modal,
          bgcolor: 'background.paper',
          boxShadow: 8,
          // En móvil ocupa toda la pantalla; en escritorio, un panel abajo a la derecha
          inset: { xs: 0, sm: 'auto' },
          right: { sm: 24 },
          bottom: { sm: 24 },
          width: { sm: 380 },
          height: { sm: 560 },
          maxHeight: { sm: 'calc(100vh - 48px)' },
          borderRadius: { xs: 0, sm: 1 },
          overflow: 'hidden',
        }}
      >
        <ChatAccidente
          onAccidenteRegistrado={onAccidenteRegistrado}
          accionEncabezado={
            <IconButton
              aria-label="Cerrar chat"
              onClick={() => setAbierto(false)}
              edge="end"
            >
              <IconoCerrar />
            </IconButton>
          }
        />
      </Box>
    </>
  )
}

export default ChatFlotante
