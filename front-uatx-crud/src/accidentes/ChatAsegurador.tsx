import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  SvgIcon,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { ApiError } from '../api/peticion.ts'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'
import { formatearFechaHora } from '../utils/fechas.ts'
import {
  actualizarAccidente,
  consultarAccidentes,
  obtenerAccidente,
} from './api.ts'
import DetalleAccidenteDialog from './DetalleAccidenteDialog.tsx'
import { COLOR_ESTADO, ETIQUETA_ESTADO } from './estados.ts'
import type {
  AccidenteAsegurador,
  AccidenteMencionado,
  ActualizarAccidenteDto,
  MensajeChat,
} from './types.ts'

// Lo que se muestra en el chat; al backend solo viajan rol y texto
interface MensajeVisible extends MensajeChat {
  accidentes?: AccidenteMencionado[] // los que menciona la respuesta
}

// El saludo y las sugerencias son fijos: no llaman a Gemini ni se mandan en
// el historial
const SALUDO =
  'Hola, soy tu asistente de accidentes. Pregúntame cuántos hay en cada estado, de quién son o los detalles de alguno.'
const SUGERENCIAS = [
  '¿Cuántos accidentes hay pendientes?',
  'Resumen de accidentes por estado',
  'Accidentes graves de esta semana',
]

// Mismos límites que el backend (ConsultaAseguradorDto)
const MAXIMO_CARACTERES = 2000

const ERROR_ASISTENTE = 'No se pudo contactar al asistente, inténtalo de nuevo'
const ERROR_NO_EXISTE = 'El accidente ya no existe'
const ERROR_DETALLE = 'No se pudo abrir el accidente, inténtalo de nuevo'

function IconoEnviar() {
  return (
    <SvgIcon fontSize="small">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </SvgIcon>
  )
}

function IconoNuevaConversacion() {
  return (
    <SvgIcon fontSize="small">
      <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m-3 9h-4v4h-2v-4H7V9h4V5h2v4h4z" />
    </SvgIcon>
  )
}

function aHistorial(mensajes: MensajeVisible[]): MensajeChat[] {
  return mensajes.map(({ rol, texto }) => ({ rol, texto }))
}

interface ChatAseguradorProps {
  // Se dibuja a la derecha del encabezado (p. ej. el botón para cerrar el chat)
  accionEncabezado?: ReactNode
  // Se llama al guardar un cambio desde el detalle (p. ej. para recargar la tabla)
  onAccidenteActualizado?: () => void
}

// Chat de solo lectura del asegurador: pregunta por los accidentes y Gemini
// responde con datos que el backend consulta. La conversación vive solo aquí:
// se manda completa en cada turno y recargar la página la reinicia. Ocupa todo
// el alto de su contenedor
function ChatAsegurador({
  accionEncabezado,
  onAccidenteActualizado,
}: ChatAseguradorProps) {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [mensajes, setMensajes] = useState<MensajeVisible[]>([])
  const [texto, setTexto] = useState('')
  const [escribiendo, setEscribiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Accidente que se está pidiendo con "Ver" y el que está abierto en el detalle
  const [abriendoId, setAbriendoId] = useState<string | null>(null)
  const [detalle, setDetalle] = useState<AccidenteAsegurador | null>(null)
  const finRef = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)

  // Mantiene visible el último mensaje
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest' })
  }, [mensajes, escribiendo])

  async function preguntar(pregunta: string) {
    const limpio = pregunta.trim()
    if (!limpio || escribiendo || !token) return

    const historial: MensajeVisible[] = [
      ...mensajes,
      { rol: 'usuario', texto: limpio },
    ]
    setMensajes(historial)
    setTexto('')
    setError(null)
    setEscribiendo(true)
    try {
      const respuesta = await consultarAccidentes(token, {
        mensajes: aHistorial(historial),
        zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      setMensajes([
        ...historial,
        {
          rol: 'asistente',
          texto: respuesta.mensaje,
          accidentes: respuesta.accidentes,
        },
      ])
    } catch (e) {
      if (manejarSesionExpirada(e)) return
      // Se conserva la conversación: la pregunta vuelve al campo para reintentar
      setMensajes(mensajes)
      setTexto(limpio)
      setError(
        e instanceof ApiError && e.status === 400 ? e.message : ERROR_ASISTENTE,
      )
    } finally {
      setEscribiendo(false)
    }
    campoRef.current?.focus()
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault()
    void preguntar(texto)
  }

  // Pide el accidente completo, con datos frescos, y abre el detalle
  async function ver(id: string) {
    if (!token || abriendoId) return
    setError(null)
    setAbriendoId(id)
    try {
      setDetalle(await obtenerAccidente(token, id))
    } catch (e) {
      if (manejarSesionExpirada(e)) return
      setError(
        e instanceof ApiError && e.status === 404
          ? ERROR_NO_EXISTE
          : ERROR_DETALLE,
      )
    } finally {
      setAbriendoId(null)
    }
  }

  // Un 401 cierra la sesión; cualquier error se relanza para que el diálogo
  // muestre el mensaje sin cerrarse
  async function guardarCambios(id: string, dto: ActualizarAccidenteDto) {
    if (!token) return
    try {
      const actualizado = await actualizarAccidente(token, id, dto)
      setDetalle(actualizado)
      // El estado nuevo también se ve en las listas "Ver" del chat
      setMensajes((lista) =>
        lista.map((mensaje) =>
          mensaje.accidentes?.some((a) => a.id === id)
            ? {
                ...mensaje,
                accidentes: mensaje.accidentes.map((a) =>
                  a.id === id ? { ...a, estado: actualizado.estado } : a,
                ),
              }
            : mensaje,
        ),
      )
      onAccidenteActualizado?.()
    } catch (err) {
      manejarSesionExpirada(err)
      throw err
    }
  }

  // Vuelve al saludo y a las sugerencias
  function nuevaConversacion() {
    setMensajes([])
    setTexto('')
    setError(null)
    campoRef.current?.focus()
  }

  return (
    <Paper
      variant="outlined"
      component="section"
      aria-label="Asistente de accidentes"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 1,
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" component="h2">
            Asistente de accidentes
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulta con IA Gemini
          </Typography>
        </Box>
        {/* El span deja que el tooltip funcione con el botón desactivado */}
        <Tooltip title="Nueva conversación">
          <span>
            <IconButton
              aria-label="Nueva conversación"
              onClick={nuevaConversacion}
              disabled={escribiendo || mensajes.length === 0}
            >
              <IconoNuevaConversacion />
            </IconButton>
          </span>
        </Tooltip>
        {accionEncabezado}
      </Box>

      <Stack
        role="log"
        aria-live="polite"
        spacing={1}
        sx={{ flex: 1, overflowY: 'auto', p: 2 }}
      >
        <Burbuja mensaje={{ rol: 'asistente', texto: SALUDO }} />
        {mensajes.length === 0 && (
          <Stack
            direction="row"
            aria-label="Preguntas sugeridas"
            sx={{ flexWrap: 'wrap', gap: 1 }}
          >
            {SUGERENCIAS.map((sugerencia) => (
              <Chip
                key={sugerencia}
                label={sugerencia}
                variant="outlined"
                color="primary"
                onClick={() => void preguntar(sugerencia)}
              />
            ))}
          </Stack>
        )}
        {mensajes.map((mensaje, indice) => (
          <Stack key={indice} spacing={1}>
            <Burbuja mensaje={mensaje} />
            {!!mensaje.accidentes?.length && (
              <ListaAccidentes
                accidentes={mensaje.accidentes}
                abriendoId={abriendoId}
                onVer={(id) => void ver(id)}
              />
            )}
          </Stack>
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
          placeholder="Pregunta por los accidentes"
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

      {/* Se monta después del panel flotante, así que queda encima de él */}
      {detalle && (
        <DetalleAccidenteDialog
          key={detalle.id}
          accidente={detalle}
          onCerrar={() => setDetalle(null)}
          onGuardar={(dto) => guardarCambios(detalle.id, dto)}
        />
      )}
    </Paper>
  )
}

interface ListaAccidentesProps {
  accidentes: AccidenteMencionado[]
  abriendoId: string | null
  onVer: (id: string) => void
}

// Accidentes que menciona una respuesta, con el botón "Ver" para abrir su detalle
function ListaAccidentes({ accidentes, abriendoId, onVer }: ListaAccidentesProps) {
  return (
    <Stack
      component="ul"
      aria-label="Accidentes mencionados"
      spacing={1}
      sx={{ listStyle: 'none', m: 0, p: 0, maxWidth: '85%' }}
    >
      {accidentes.map((accidente) => (
        <Paper
          key={accidente.id}
          component="li"
          variant="outlined"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 1,
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
              {accidente.aseguradoNombre}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="p">
              {accidente.vehiculoPlacas} ·{' '}
              {formatearFechaHora(accidente.fechaHoraAccidente)}
            </Typography>
            <Chip
              label={ETIQUETA_ESTADO[accidente.estado]}
              color={COLOR_ESTADO[accidente.estado]}
              size="small"
              sx={{ mt: 0.5 }}
            />
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => onVer(accidente.id)}
            disabled={abriendoId !== null}
            aria-label={`Ver accidente de ${accidente.aseguradoNombre}, placas ${accidente.vehiculoPlacas}`}
            startIcon={
              abriendoId === accidente.id ? (
                <CircularProgress size={14} color="inherit" />
              ) : undefined
            }
          >
            Ver
          </Button>
        </Paper>
      ))}
    </Stack>
  )
}

function Burbuja({ mensaje }: { mensaje: MensajeVisible }) {
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
        // Respeta los saltos de línea del texto plano de Gemini
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      <Typography variant="body2">{mensaje.texto}</Typography>
    </Box>
  )
}

export default ChatAsegurador
