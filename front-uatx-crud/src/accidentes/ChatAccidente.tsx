import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  SvgIcon,
  TextField,
  Typography,
} from '@mui/material'
import { ApiError } from '../api/peticion.ts'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'
import { conversar } from './api.ts'
import type { MensajeChat } from './types.ts'

const PREGUNTA_INICIAL: MensajeChat = {
  rol: 'asistente',
  texto: '¿Estás bien?',
}

// Mismos límites que ChatDto en el backend
const MAXIMO_CARACTERES = 2000

const ERROR_ASISTENTE = 'No se pudo contactar al asistente, inténtalo de nuevo'

function IconoEnviar() {
  return (
    <SvgIcon fontSize="small">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </SvgIcon>
  )
}

// Entrevista guiada por Gemini para reportar un accidente. La conversación vive
// solo aquí: se manda completa en cada turno y recargar la página la reinicia
function ChatAccidente() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [mensajes, setMensajes] = useState<MensajeChat[]>([PREGUNTA_INICIAL])
  const [texto, setTexto] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)

  // Mantiene visible el último mensaje
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest' })
  }, [mensajes, escribiendo])

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const limpio = texto.trim()
    if (!limpio || escribiendo || !token) return

    const historial: MensajeChat[] = [
      ...mensajes,
      { rol: 'usuario', texto: limpio },
    ]
    setMensajes(historial)
    setTexto('')
    setError(null)
    setEscribiendo(true)
    try {
      const respuesta = await conversar(token, historial)
      setMensajes([
        ...historial,
        { rol: 'asistente', texto: respuesta.mensaje },
      ])
    } catch (e) {
      if (manejarSesionExpirada(e)) return
      // Se conserva la conversación: el mensaje vuelve al campo para reintentar
      setMensajes(mensajes)
      setTexto(limpio)
      setError(
        e instanceof ApiError && e.status === 400 ? e.message : ERROR_ASISTENTE,
      )
    } finally {
      setEscribiendo(false)
      campoRef.current?.focus()
    }
  }

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label="Chat con IA Gemini"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: { xs: 480, md: 560 },
      }}
    >
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="h6" component="h2">
          Chat con IA Gemini
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Reporta un accidente vehicular
        </Typography>
      </Box>

      <Stack
        role="log"
        aria-live="polite"
        spacing={1}
        sx={{ flex: 1, overflowY: 'auto', p: 2 }}
      >
        {mensajes.map((mensaje, indice) => (
          <Burbuja key={indice} mensaje={mensaje} />
        ))}
        {escribiendo && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              Gemini está escribiendo…
            </Typography>
          </Stack>
        )}
        <div ref={finRef} />
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mx: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={enviar}
        sx={{ display: 'flex', gap: 1, p: 2, alignItems: 'flex-end' }}
      >
        <TextField
          inputRef={campoRef}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter envía; Shift+Enter hace un salto de línea
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              e.currentTarget.closest('form')?.requestSubmit()
            }
          }}
          placeholder="Escribe tu mensaje"
          size="small"
          fullWidth
          multiline
          maxRows={4}
          disabled={escribiendo}
          slotProps={{
            htmlInput: {
              maxLength: MAXIMO_CARACTERES,
              'aria-label': 'Mensaje',
            },
          }}
        />
        <IconButton
          type="submit"
          color="primary"
          aria-label="Enviar"
          disabled={escribiendo || !texto.trim()}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <IconoEnviar />
        </IconButton>
      </Box>
    </Paper>
  )
}

function Burbuja({ mensaje }: { mensaje: MensajeChat }) {
  const esUsuario = mensaje.rol === 'usuario'
  return (
    <Box
      sx={{
        alignSelf: esUsuario ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        px: 1.5,
        py: 1,
        borderRadius: 2,
        bgcolor: esUsuario ? 'primary.main' : 'grey.100',
        color: esUsuario ? 'primary.contrastText' : 'text.primary',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      <Typography variant="body2">{mensaje.texto}</Typography>
    </Box>
  )
}

export default ChatAccidente
