import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AppHeader from '../components/AppHeader.tsx'
import AseguradosTabla from '../asegurados/AseguradosTabla.tsx'
import { listar } from '../asegurados/api.ts'
import type { Asegurado } from '../asegurados/types.ts'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'

// Minúsculas y sin acentos, para que "perez" encuentre a "Pérez"
function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

function AseguradosPage() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [asegurados, setAsegurados] = useState<Asegurado[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState('')

  const manejarError = useCallback(
    (err: unknown) => {
      if (manejarSesionExpirada(err)) return
      setError(err instanceof Error ? err.message : 'Ocurrió un error')
    },
    [manejarSesionExpirada],
  )

  // Carga inicial; `vigente` descarta la respuesta si la página se desmontó
  useEffect(() => {
    if (!token) return
    let vigente = true
    listar(token)
      .then((lista) => {
        if (vigente) setAsegurados(lista)
      })
      .catch((err: unknown) => {
        if (vigente) manejarError(err)
      })
    return () => {
      vigente = false
    }
  }, [token, manejarError])

  // Vuelve a pedir la lista (reintento y, más adelante, después de guardar)
  const recargar = useCallback(async () => {
    if (!token) return
    setError(null)
    try {
      setAsegurados(await listar(token))
    } catch (err) {
      manejarError(err)
    }
  }, [token, manejarError])

  // El filtro es solo en el cliente: no hace peticiones nuevas
  const filtrados = useMemo(() => {
    const termino = normalizar(busqueda.trim())
    if (!asegurados || !termino) return asegurados
    return asegurados.filter((a) =>
      [a.nombre, a.correo, a.idContrato].some((campo) =>
        normalizar(campo).includes(termino),
      ),
    )
  }, [asegurados, busqueda])

  function contenido() {
    if (error) {
      return (
        <Alert
          severity="error"
          action={
            <Button color="inherit" size="small" onClick={() => void recargar()}
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
          <CircularProgress aria-label="Cargando asegurados" />
        </Box>
      )
    }
    if (filtrados.length === 0) {
      return (
        <Paper variant="outlined" sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {asegurados?.length
              ? 'Ningún asegurado coincide con la búsqueda'
              : 'Todavía no hay asegurados registrados'}
          </Typography>
        </Paper>
      )
    }
    return <AseguradosTabla asegurados={filtrados} />
  }

  return (
    <>
      <AppHeader />
      <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 4 } }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ mb: 3, alignItems: { sm: 'center' } }}
        >
          <Typography variant="h5" component="h2" sx={{ flex: 1 }}>
            Asegurados
          </Typography>
          <TextField
            label="Buscar"
            placeholder="Nombre, correo o idContrato"
            size="small"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            sx={{ width: { xs: '100%', sm: 320 } }}
          />
        </Stack>
        {contenido()}
      </Box>
    </>
  )
}

export default AseguradosPage
