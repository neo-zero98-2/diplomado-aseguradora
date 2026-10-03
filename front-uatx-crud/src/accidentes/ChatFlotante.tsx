import { useState, type ReactNode } from 'react'
import { Box, Fab, IconButton, SvgIcon, Tooltip } from '@mui/material'

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
  // Tooltip del botón y nombre accesible del panel, p. ej. "Chat con IA Gemini"
  etiqueta: string
  // El chat que va dentro del panel; recibe el botón para cerrarlo, que se
  // dibuja en su encabezado
  children: (accionCerrar: ReactNode) => ReactNode
}

// Botón flotante en la esquina inferior derecha que abre un chat de Gemini.
// Cerrar solo oculta el panel: el chat sigue montado y su conversación (y, en
// el del asegurado, la foto y su constancia) se conserva hasta recargar la página
function ChatFlotante({ etiqueta, children }: ChatFlotanteProps) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      {!abierto && (
        <Tooltip title={etiqueta} placement="left">
          <Fab
            color="primary"
            aria-label={`Abrir ${etiqueta.charAt(0).toLowerCase()}${etiqueta.slice(1)}`}
            onClick={() => setAbierto(true)}
            sx={{ position: 'fixed', right: 24, bottom: 24 }}
          >
            <IconoChat />
          </Fab>
        </Tooltip>
      )}

      <Box
        role="dialog"
        aria-label={etiqueta}
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
        {children(
          <IconButton
            aria-label="Cerrar chat"
            onClick={() => setAbierto(false)}
            edge="end"
          >
            <IconoCerrar />
          </IconButton>,
        )}
      </Box>
    </>
  )
}

export default ChatFlotante
