import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'
import { formatearFechaHora } from '../utils/fechas.ts'
import { normalizar } from '../utils/texto.ts'
import { listarAccidentes } from './api.ts'
import {
  COLOR_ESTADO,
  COLOR_GRAVEDAD,
  ESTADOS,
  ETIQUETA_ESTADO,
  ETIQUETA_GRAVEDAD,
} from './estados.ts'
import type { AccidenteAsegurador, EstadoAccidente } from './types.ts'

type FiltroEstado = EstadoAccidente | 'todos'

// Herramienta de trabajo del asegurador en /home. Pide la lista una vez; el
// filtro por estado y la búsqueda se hacen en el cliente, sin peticiones nuevas
function AccidentesTabla() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [accidentes, setAccidentes] = useState<AccidenteAsegurador[] | null>(
    null,
  )
  const [error, setError] = useState<string | null>(null)
  // Cambia con "Reintentar" para volver a pedir la lista
  const [intento, setIntento] = useState(0)
  const [estado, setEstado] = useState<FiltroEstado>('pendiente')
  const [busqueda, setBusqueda] = useState('')

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
    listarAccidentes(token)
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
  }, [token, manejarError, intento])

  const filtrados = useMemo(() => {
    if (!accidentes) return null
    const termino = normalizar(busqueda.trim())
    return accidentes.filter(
      (a) =>
        (estado === 'todos' || a.estado === estado) &&
        (!termino ||
          [a.asegurado.nombre, a.asegurado.idContrato, a.vehiculoPlacas].some(
            (campo) => normalizar(campo).includes(termino),
          )),
    )
  }, [accidentes, estado, busqueda])

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
    if (!filtrados) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label="Cargando accidentes" />
        </Box>
      )
    }
    if (filtrados.length === 0) {
      return (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {accidentes?.length
              ? 'Ningún accidente coincide con el filtro'
              : 'Todavía no hay accidentes reportados'}
          </Typography>
        </Paper>
      )
    }
    return (
      // En pantallas chicas la tabla se desplaza en horizontal dentro del Paper
      <TableContainer component={Paper} variant="outlined">
        <Table
          size="small"
          aria-label="Accidentes"
          // Celdas más angostas para que quepa sin scroll en escritorio
          sx={{ minWidth: 760, '& th, & td': { px: 1.5 } }}
        >
          <TableHead>
            <TableRow>
              <TableCell>Asegurado</TableCell>
              <TableCell>idContrato</TableCell>
              <TableCell>Fecha del accidente</TableCell>
              <TableCell>Placas</TableCell>
              <TableCell>Gravedad</TableCell>
              <TableCell>Estado</TableCell>
              <TableCell align="right">Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtrados.map((accidente) => (
              <TableRow key={accidente.id} hover>
                <TableCell>{accidente.asegurado.nombre}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {accidente.asegurado.idContrato}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {formatearFechaHora(accidente.fechaHoraAccidente)}
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {accidente.vehiculoPlacas}
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
                <TableCell align="right">
                  {/* Se conectan en los pasos 13 (Ver) y 14 (Eliminar) */}
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{ justifyContent: 'flex-end' }}
                  >
                    <Button
                      size="small"
                      disabled
                      aria-label={`Ver el accidente de ${accidente.asegurado.nombre}`}
                    >
                      Ver
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      disabled
                      aria-label={`Eliminar el accidente de ${accidente.asegurado.nombre}`}
                    >
                      Eliminar
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  return (
    <Box component="section" aria-labelledby="titulo-accidentes">
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ mb: 1.5, alignItems: { sm: 'center' } }}
      >
        <Typography
          id="titulo-accidentes"
          variant="h6"
          component="h2"
          sx={{ flex: 1 }}
        >
          Accidentes
        </Typography>
        <TextField
          select
          label="Estado"
          size="small"
          value={estado}
          onChange={(e) => setEstado(e.target.value as FiltroEstado)}
          sx={{ width: { xs: '100%', sm: 170 } }}
        >
          <MenuItem value="todos">Todos</MenuItem>
          {ESTADOS.map((valor) => (
            <MenuItem key={valor} value={valor}>
              {ETIQUETA_ESTADO[valor]}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Buscar"
          placeholder="Asegurado, idContrato o placas"
          size="small"
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          sx={{ width: { xs: '100%', sm: 280 } }}
        />
      </Stack>
      {contenido()}
    </Box>
  )
}

export default AccidentesTabla
