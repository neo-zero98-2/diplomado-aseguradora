import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'
import { formatearFecha, formatearFechaHora } from '../utils/fechas.ts'
import { obtenerFotoAccidente } from './api.ts'
import {
  COLOR_ESTADO,
  COLOR_GRAVEDAD,
  ESTADOS,
  ETIQUETA_ESTADO,
  ETIQUETA_GRAVEDAD,
} from './estados.ts'
import type {
  AccidenteAsegurador,
  ActualizarAccidenteDto,
  EstadoAccidente,
} from './types.ts'

// Mismo límite que el backend (ActualizarAccidenteDto)
const MAXIMO_NOTA = 1000

interface DetalleAccidenteDialogProps {
  accidente: AccidenteAsegurador
  onCerrar: () => void
  // Guarda los cambios y actualiza la fila en la tabla; si falla, lanza el
  // error para que el diálogo muestre el mensaje
  onGuardar: (dto: ActualizarAccidenteDto) => Promise<void>
}

// Detalle de un accidente para el asegurador: a quién pertenece, el reporte
// completo, la foto y el formulario para cambiar el estado y la nota
function DetalleAccidenteDialog({
  accidente,
  onCerrar,
  onGuardar,
}: DetalleAccidenteDialogProps) {
  const theme = useTheme()
  const pantallaCompleta = useMediaQuery(theme.breakpoints.down('sm'))
  const [estado, setEstado] = useState<EstadoAccidente>(accidente.estado)
  const [nota, setNota] = useState(accidente.notaAsegurador ?? '')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  const cambioEstado = estado !== accidente.estado
  const cambioNota = nota.trim() !== (accidente.notaAsegurador ?? '')

  async function guardar(evento: FormEvent) {
    evento.preventDefault()
    if (!cambioEstado && !cambioNota) return

    const dto: ActualizarAccidenteDto = {}
    if (cambioEstado) dto.estado = estado
    // Una nota vacía la borra
    if (cambioNota) dto.notaAsegurador = nota.trim() || null

    setError(null)
    setGuardado(false)
    setGuardando(true)
    try {
      await onGuardar(dto)
      setNota(nota.trim())
      setGuardado(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ocurrió un error')
    } finally {
      setGuardando(false)
    }
  }

  const ubicacion =
    accidente.latitud !== null && accidente.longitud !== null
      ? `${accidente.latitud.toFixed(5)}, ${accidente.longitud.toFixed(5)}`
      : null

  return (
    <Dialog
      open
      onClose={guardando ? undefined : onCerrar}
      fullScreen={pantallaCompleta}
      fullWidth
      maxWidth="md"
      aria-labelledby="detalle-accidente-titulo"
    >
      <Box
        component="form"
        onSubmit={guardar}
        noValidate
        sx={{ display: 'contents' }}
      >
        <DialogTitle id="detalle-accidente-titulo">
          Accidente de {accidente.asegurado.nombre}
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={3}>
            <Seccion titulo="Asegurado">
              <Datos
                filas={[
                  ['Nombre', accidente.asegurado.nombre],
                  ['idContrato', accidente.asegurado.idContrato],
                  ['Correo', accidente.asegurado.correo],
                  [
                    'Vencimiento de la póliza',
                    formatearFecha(accidente.asegurado.fechaVencimiento),
                  ],
                ]}
              />
            </Seccion>

            <Divider />

            <Seccion titulo="Reporte">
              <Stack
                direction="row"
                spacing={1}
                sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}
              >
                <Chip
                  size="small"
                  label={ETIQUETA_ESTADO[accidente.estado]}
                  color={COLOR_ESTADO[accidente.estado]}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Gravedad: ${ETIQUETA_GRAVEDAD[accidente.gravedad]}`}
                  color={COLOR_GRAVEDAD[accidente.gravedad]}
                />
              </Stack>
              <Datos
                filas={[
                  [
                    'Fecha del accidente',
                    formatearFechaHora(accidente.fechaHoraAccidente),
                  ],
                  [
                    'Fecha del reporte',
                    formatearFechaHora(accidente.fechaReporte),
                  ],
                  [
                    '¿El asegurado estaba bien?',
                    accidente.aseguradoBien ? 'Sí' : 'No',
                  ],
                  ['Ubicación', ubicacion ?? accidente.direccion ?? '—'],
                  [
                    'Vehículo',
                    `${accidente.vehiculoMarca} ${accidente.vehiculoModelo}`,
                  ],
                  ['Placas', accidente.vehiculoPlacas],
                  [
                    'Terceros',
                    accidente.hayTerceros
                      ? (accidente.tercerosDescripcion ?? '—')
                      : 'Sin terceros involucrados',
                  ],
                ]}
              />
              <Datos
                ancho
                filas={[
                  ['Resumen', accidente.resumen],
                  ['Análisis de la foto', accidente.fotoDescripcion],
                ]}
              />
            </Seccion>

            <Seccion titulo="Foto">
              <FotoAccidente id={accidente.id} />
            </Seccion>

            <Divider />

            <Seccion titulo="Seguimiento">
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {accidente.fechaActualizacion
                  ? `Última actualización: ${accidente.actualizadoPor?.nombre ?? 'Asegurador eliminado'}, ${formatearFechaHora(accidente.fechaActualizacion)}`
                  : 'Ningún asegurador lo ha actualizado todavía'}
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Estado"
                  size="small"
                  value={estado}
                  onChange={(e) => {
                    setEstado(e.target.value as EstadoAccidente)
                    setGuardado(false)
                  }}
                  disabled={guardando}
                  sx={{ maxWidth: { sm: 240 } }}
                >
                  {ESTADOS.map((valor) => (
                    <MenuItem key={valor} value={valor}>
                      {ETIQUETA_ESTADO[valor]}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Nota del asegurador"
                  placeholder="El asegurado verá esta nota en su tabla de accidentes"
                  value={nota}
                  onChange={(e) => {
                    setNota(e.target.value)
                    setGuardado(false)
                  }}
                  disabled={guardando}
                  multiline
                  minRows={2}
                  maxRows={6}
                  helperText={`${nota.length}/${MAXIMO_NOTA}`}
                  slotProps={{ htmlInput: { maxLength: MAXIMO_NOTA } }}
                />
                {error && <Alert severity="error">{error}</Alert>}
                {guardado && (
                  <Alert severity="success">Cambios guardados</Alert>
                )}
              </Stack>
            </Seccion>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={onCerrar} disabled={guardando}>
            Cerrar
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={guardando || (!cambioEstado && !cambioNota)}
          >
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}

function Seccion({
  titulo,
  children,
}: {
  titulo: string
  children: ReactNode
}) {
  return (
    <Box component="section">
      <Typography variant="subtitle1" component="h3" sx={{ mb: 1.5 }}>
        {titulo}
      </Typography>
      {children}
    </Box>
  )
}

// Lista de etiqueta/valor; en escritorio va en dos columnas salvo con `ancho`
function Datos({
  filas,
  ancho = false,
}: {
  filas: [string, string][]
  ancho?: boolean
}) {
  return (
    <Box
      component="dl"
      sx={{
        m: 0,
        mt: ancho ? 2 : 0,
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: ancho ? '1fr' : '1fr 1fr' },
        columnGap: 3,
        rowGap: 1.5,
      }}
    >
      {filas.map(([etiqueta, valor]) => (
        <Box key={etiqueta}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {etiqueta}
          </Typography>
          <Typography
            component="dd"
            variant="body2"
            sx={{ m: 0, wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}
          >
            {valor}
          </Typography>
        </Box>
      ))}
    </Box>
  )
}

// Pide la URL firmada al abrir el detalle; dura 10 minutos y al reabrir se
// pide una nueva
function FotoAccidente({ id }: { id: string }) {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let vigente = true
    obtenerFotoAccidente(token, id)
      .then((foto) => {
        if (vigente) setUrl(foto.url)
      })
      .catch((err: unknown) => {
        if (!vigente || manejarSesionExpirada(err)) return
        setError(err instanceof Error ? err.message : 'Ocurrió un error')
      })
    return () => {
      vigente = false
    }
  }, [token, id, manejarSesionExpirada])

  if (error) {
    return <Alert severity="error">No se pudo cargar la foto: {error}</Alert>
  }
  if (!url) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={28} aria-label="Cargando la foto" />
      </Box>
    )
  }
  return (
    <Box
      component="a"
      href={url}
      target="_blank"
      rel="noreferrer"
      title="Abrir la foto en otra pestaña"
      sx={{ display: 'block' }}
    >
      <Box
        component="img"
        src={url}
        alt="Foto del accidente"
        sx={{
          display: 'block',
          width: '100%',
          maxHeight: 360,
          objectFit: 'contain',
          bgcolor: 'grey.100',
          borderRadius: 1,
        }}
      />
    </Box>
  )
}

export default DetalleAccidenteDialog
