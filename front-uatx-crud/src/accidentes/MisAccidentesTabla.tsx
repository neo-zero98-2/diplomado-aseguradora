import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'
import { formatearFechaHora } from '../utils/fechas.ts'
import { listarMisAccidentes } from './api.ts'
import {
  COLOR_ESTADO,
  COLOR_GRAVEDAD,
  ETIQUETA_ESTADO,
  ETIQUETA_GRAVEDAD,
} from './estados.ts'
import type { MiAccidente } from './types.ts'

interface MisAccidentesTablaProps {
  // Cambia cada vez que el chat registra un accidente: la tabla se recarga
  recarga: number
}

// Tabla informativa del asegurado: solo lectura, sin acciones
function MisAccidentesTabla({ recarga }: MisAccidentesTablaProps) {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [accidentes, setAccidentes] = useState<MiAccidente[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Cambia con "Reintentar" para volver a pedir la lista
  const [intento, setIntento] = useState(0)

  const manejarError = useCallback(
    (err: unknown) => {
      if (manejarSesionExpirada(err)) return
      setError(err instanceof Error ? err.message : 'Ocurrió un error')
    },
    [manejarSesionExpirada],
  )

  // `vigente` descarta la respuesta si la tabla se desmontó o se volvió a pedir
  useEffect(() => {
    if (!token) return
    let vigente = true
    listarMisAccidentes(token)
      .then((lista) => {
        if (!vigente) return
        setError(null)
        setAccidentes(lista)
      })
      .catch((err: unknown) => {
        if (vigente) manejarError(err)
      })
    return () => {
      vigente = false
    }
  }, [token, manejarError, recarga, intento])

  function contenido() {
    if (error) {
      return (
        <Alert
          severity="error"
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                setError(null)
                setIntento((n) => n + 1)
              }}
            >
              Reintentar
            </Button>
          }
        >
          {error}
        </Alert>
      )
    }
    if (!accidentes) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Cargando tus accidentes" />
        </Box>
      )
    }
    if (accidentes.length === 0) {
      return (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            Aún no has reportado accidentes
          </Typography>
        </Paper>
      )
    }
    return (
      // En pantallas chicas la tabla se desplaza en horizontal dentro del Paper
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" aria-label="Mis accidentes" sx={{ minWidth: 640 }}>
          <TableHead>
            <TableRow>
              <TableCell>Fecha del accidente</TableCell>
              <TableCell>Vehículo</TableCell>
              <TableCell>Gravedad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell>Nota del asegurador</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {accidentes.map((accidente) => (
              <TableRow key={accidente.id}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatearFechaHora(accidente.fechaHoraAccidente)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {accidente.vehiculoMarca} {accidente.vehiculoModelo}
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    component="div"
                  >
                    {accidente.vehiculoPlacas}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="outlined"
                    label={ETIQUETA_GRAVEDAD[accidente.gravedad]}
                    color={COLOR_GRAVEDAD[accidente.gravedad]}
                  />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={ETIQUETA_ESTADO[accidente.estado]}
                    color={COLOR_ESTADO[accidente.estado]}
                  />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'pre-wrap', minWidth: 160 }}>
                  {accidente.notaAsegurador ?? '—'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  return (
    <Box component="section" aria-labelledby="titulo-mis-accidentes">
      <Typography
        id="titulo-mis-accidentes"
        variant="h6"
        component="h2"
        sx={{ mb: 1.5 }}
      >
        Mis accidentes
      </Typography>
      {contenido()}
    </Box>
  )
}

export default MisAccidentesTabla
