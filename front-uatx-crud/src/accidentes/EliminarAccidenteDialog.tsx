import { useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'
import { formatearFechaHora } from '../utils/fechas.ts'
import type { AccidenteAsegurador } from './types.ts'

interface EliminarAccidenteDialogProps {
  accidente: AccidenteAsegurador
  onCerrar: () => void
  // Lanza un Error con el mensaje a mostrar si no se pudo eliminar
  onEliminar: (id: string) => Promise<void>
}

// El borrado es físico (fila y foto), por eso se pide confirmación
function EliminarAccidenteDialog({
  accidente,
  onCerrar,
  onEliminar,
}: EliminarAccidenteDialogProps) {
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setError(null)
    setEliminando(true)
    try {
      await onEliminar(accidente.id)
      onCerrar()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado',
      )
      setEliminando(false)
    }
  }

  return (
    <Dialog
      open
      onClose={eliminando ? undefined : onCerrar}
      aria-labelledby="eliminar-accidente-titulo"
    >
      <DialogTitle id="eliminar-accidente-titulo">
        ¿Eliminar el accidente de {accidente.asegurado.nombre}?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Se borrará el reporte del{' '}
          {formatearFechaHora(accidente.fechaHoraAccidente)} (
          {accidente.vehiculoMarca} {accidente.vehiculoModelo}, placas{' '}
          {accidente.vehiculoPlacas}) junto con su foto. Esta acción no se
          puede deshacer.
        </DialogContentText>
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCerrar} disabled={eliminando}>
          Cancelar
        </Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => void confirmar()}
          disabled={eliminando}
        >
          {eliminando ? 'Eliminando…' : 'Eliminar'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default EliminarAccidenteDialog
