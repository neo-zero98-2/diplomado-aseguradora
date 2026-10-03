import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  Alert,
  Box,
  Button,
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
import { analizarFoto, conversar } from './api.ts'
import {
  MENSAJE_SIN_UBICACION,
  PREFIJO_FOTO_VALIDADA,
  PREFIJO_UBICACION,
} from './mensajes.ts'
import type { MensajeChat } from './types.ts'

// Lo que se muestra en el chat; al backend solo viajan rol y texto
interface MensajeVisible extends MensajeChat {
  fotoUrl?: string // vista previa local de la foto adjunta
}

// La foto que procedió y su constancia; se usan al confirmar el accidente
interface FotoValidada {
  archivo: File
  constancia: string
}

const PREGUNTA_INICIAL: MensajeVisible = {
  rol: 'asistente',
  texto: '¿Estás bien?',
}

// Mismos límites que el backend (ChatDto y la subida de la foto)
const MAXIMO_CARACTERES = 2000
const TAMANO_MAXIMO_FOTO = 5 * 1024 * 1024
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp']

const ERROR_ASISTENTE = 'No se pudo contactar al asistente, inténtalo de nuevo'
const ERROR_FOTO = 'No se pudo analizar la foto, inténtalo de nuevo'

function IconoEnviar() {
  return (
    <SvgIcon fontSize="small">
      <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </SvgIcon>
  )
}

function IconoCamara() {
  return (
    <SvgIcon fontSize="small">
      <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4" />
      <path d="M9 2 7.17 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2h-3.17L15 2zm3 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5" />
    </SvgIcon>
  )
}

function IconoUbicacion() {
  return (
    <SvgIcon fontSize="small">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7m0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5" />
    </SvgIcon>
  )
}

interface Coordenadas {
  latitud: number
  longitud: number
}

// Resuelve null si el navegador no tiene GPS, el permiso se niega o falla
function obtenerUbicacion(): Promise<Coordenadas | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({ latitud: coords.latitude, longitud: coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    )
  })
}

function aHistorial(mensajes: MensajeVisible[]): MensajeChat[] {
  return mensajes.map(({ rol, texto }) => ({ rol, texto }))
}

// Entrevista guiada por Gemini para reportar un accidente. La conversación, la
// foto validada y su constancia viven solo aquí: se manda el historial completo
// en cada turno y recargar la página la reinicia
function ChatAccidente() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [mensajes, setMensajes] = useState<MensajeVisible[]>([PREGUNTA_INICIAL])
  const [texto, setTexto] = useState('')
  const [ocupado, setOcupado] = useState<
    'escribiendo' | 'analizando' | 'ubicando' | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const [, setFotoValidada] = useState<FotoValidada | null>(null)
  // Coordenadas del GPS; si no hay, Gemini reúne la dirección escrita
  const [, setUbicacion] = useState<Coordenadas | null>(null)
  // La foto no mostró un accidente: la conversación terminó
  const [noProcede, setNoProcede] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)
  const campoRef = useRef<HTMLInputElement>(null)
  const archivoRef = useRef<HTMLInputElement>(null)
  // URLs de las vistas previas, para liberarlas al limpiar el chat
  const urlsRef = useRef<string[]>([])

  // Mantiene visible el último mensaje
  useEffect(() => {
    finRef.current?.scrollIntoView({ block: 'nearest' })
  }, [mensajes, ocupado])

  useEffect(() => {
    const urls = urlsRef.current
    return () => urls.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  // Pide a Gemini el siguiente mensaje; devuelve false si falló
  async function pedirRespuesta(historial: MensajeVisible[]) {
    if (!token) return false
    setOcupado('escribiendo')
    try {
      const respuesta = await conversar(token, aHistorial(historial))
      setMensajes([
        ...historial,
        { rol: 'asistente', texto: respuesta.mensaje },
      ])
      return true
    } catch (e) {
      if (manejarSesionExpirada(e)) return false
      setError(
        e instanceof ApiError && e.status === 400 ? e.message : ERROR_ASISTENTE,
      )
      return false
    } finally {
      setOcupado(null)
    }
  }

  async function enviar(evento: FormEvent) {
    evento.preventDefault()
    const limpio = texto.trim()
    if (!limpio || ocupado || noProcede) return

    const historial: MensajeVisible[] = [
      ...mensajes,
      { rol: 'usuario', texto: limpio },
    ]
    setMensajes(historial)
    setTexto('')
    setError(null)
    const ok = await pedirRespuesta(historial)
    if (!ok) {
      // Se conserva la conversación: el mensaje vuelve al campo para reintentar
      setMensajes(mensajes)
      setTexto(limpio)
    }
    campoRef.current?.focus()
  }

  async function adjuntarFoto(evento: ChangeEvent<HTMLInputElement>) {
    const archivo = evento.target.files?.[0]
    // Permite volver a elegir el mismo archivo
    evento.target.value = ''
    if (!archivo || !token || ocupado || noProcede) return

    setError(null)
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setError('La foto debe ser JPEG, PNG o WebP')
      return
    }
    if (archivo.size > TAMANO_MAXIMO_FOTO) {
      setError('La foto debe pesar máximo 5 MB')
      return
    }

    const fotoUrl = URL.createObjectURL(archivo)
    urlsRef.current.push(fotoUrl)
    setMensajes([
      ...mensajes,
      { rol: 'usuario', texto: 'Foto del accidente', fotoUrl },
    ])
    setOcupado('analizando')

    let analisis
    try {
      analisis = await analizarFoto(token, archivo)
    } catch (e) {
      setOcupado(null)
      if (manejarSesionExpirada(e)) return
      setMensajes(mensajes)
      setError(
        e instanceof ApiError && e.status === 400 ? e.message : ERROR_FOTO,
      )
      return
    }

    if (!analisis.procede) {
      setOcupado(null)
      setMensajes([
        ...mensajes,
        { rol: 'usuario', texto: 'Foto del accidente', fotoUrl },
        { rol: 'asistente', texto: analisis.mensaje },
      ])
      setNoProcede(true)
      return
    }

    // Una foto nueva que procede reemplaza a la anterior
    setFotoValidada({ archivo, constancia: analisis.constancia })
    // El resultado entra al historial para que Gemini sepa que ya tiene la foto
    const historial: MensajeVisible[] = [
      ...mensajes,
      {
        rol: 'usuario',
        texto: `${PREFIJO_FOTO_VALIDADA} ${analisis.descripcion} Gravedad: ${analisis.gravedad}.`,
        fotoUrl,
      },
    ]
    setMensajes(historial)
    // Si Gemini falla, la foto validada se queda en el historial y la
    // conversación sigue con el siguiente mensaje del asegurado
    await pedirRespuesta(historial)
  }

  // La ubicación entra al historial para que Gemini sepa si ya la tiene o si
  // debe pedir la dirección escrita
  async function compartirUbicacion() {
    if (ocupado || noProcede) return

    setError(null)
    setOcupado('ubicando')
    const coordenadas = await obtenerUbicacion()
    setUbicacion(coordenadas)
    const texto = coordenadas
      ? `${PREFIJO_UBICACION} ${coordenadas.latitud.toFixed(5)}, ${coordenadas.longitud.toFixed(5)}`
      : MENSAJE_SIN_UBICACION
    const historial: MensajeVisible[] = [
      ...mensajes,
      { rol: 'usuario', texto },
    ]
    setMensajes(historial)
    await pedirRespuesta(historial)
  }

  // Descarta la conversación, la foto validada y su constancia
  function nuevoReporte() {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
    setMensajes([PREGUNTA_INICIAL])
    setTexto('')
    setError(null)
    setFotoValidada(null)
    setUbicacion(null)
    setNoProcede(false)
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
        {ocupado && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CircularProgress size={14} />
            <Typography variant="body2" color="text.secondary">
              {ocupado === 'analizando'
                ? 'Gemini está analizando la foto…'
                : ocupado === 'ubicando'
                  ? 'Obteniendo tu ubicación…'
                  : 'Gemini está escribiendo…'}
            </Typography>
          </Stack>
        )}
        {noProcede && (
          <Button
            variant="contained"
            onClick={nuevoReporte}
            sx={{ alignSelf: 'center' }}
          >
            Nuevo reporte
          </Button>
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
        <input
          ref={archivoRef}
          type="file"
          accept="image/*"
          // En móvil abre la cámara trasera; en escritorio se ignora
          capture="environment"
          hidden
          onChange={adjuntarFoto}
        />
        {/* El span deja que el tooltip funcione con el botón desactivado */}
        <Tooltip title="Adjuntar foto">
          <span>
            <IconButton
              aria-label="Adjuntar foto"
              disabled={!!ocupado || noProcede}
              onClick={() => archivoRef.current?.click()}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <IconoCamara />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Compartir ubicación">
          <span>
            <IconButton
              aria-label="Compartir ubicación"
              disabled={!!ocupado || noProcede}
              onClick={compartirUbicacion}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
            >
              <IconoUbicacion />
            </IconButton>
          </span>
        </Tooltip>
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
          disabled={!!ocupado || noProcede}
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
          disabled={!!ocupado || noProcede || !texto.trim()}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}
        >
          <IconoEnviar />
        </IconButton>
      </Box>
    </Paper>
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
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {mensaje.fotoUrl && (
        <Box
          component="img"
          src={mensaje.fotoUrl}
          alt="Foto del accidente"
          sx={{
            display: 'block',
            width: '100%',
            maxHeight: 200,
            objectFit: 'cover',
            borderRadius: 1,
            mb: 0.5,
          }}
        />
      )}
      <Typography variant="body2">{mensaje.texto}</Typography>
    </Box>
  )
}

export default ChatAccidente
