import { useEffect, useState } from 'react'
import { Alert, Box, CircularProgress, Typography } from '@mui/material'
import AppHeader from '../components/AppHeader.tsx'
import { listar } from '../asegurados/api.ts'
import type { Asegurado } from '../asegurados/types.ts'
import { useSesionExpirada } from '../auth/useSesionExpirada.ts'
import { useAppSelector } from '../store/index.ts'

// La tabla y los diálogos del CRUD llegan en los pasos 10 a 12 de la SPEC 02
function AseguradosPage() {
  const token = useAppSelector((state) => state.auth.accessToken)
  const manejarSesionExpirada = useSesionExpirada()
  const [asegurados, setAsegurados] = useState<Asegurado[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let vigente = true
    listar(token)
      .then((lista) => {
        if (vigente) setAsegurados(lista)
      })
      .catch((err: unknown) => {
        if (!vigente || manejarSesionExpirada(err)) return
        setError(err instanceof Error ? err.message : 'Ocurrió un error')
      })
    return () => {
      vigente = false
    }
  }, [token, manejarSesionExpirada])

  return (
    <>
      <AppHeader />
      <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 4 } }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Asegurados
        </Typography>
        {error ? (
          <Alert severity="error">{error}</Alert>
        ) : asegurados ? (
          <Typography>{asegurados.length} asegurados registrados</Typography>
        ) : (
          <CircularProgress aria-label="Cargando asegurados" />
        )}
      </Box>
    </>
  )
}

export default AseguradosPage
