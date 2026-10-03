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
import type { Asegurado } from './types.ts'

interface EliminarAseguradoDialogProps {
  asegurado: Asegurado
  onCerrar: () => void
  // Lanza un Error con el mensaje a mostrar si no se pudo eliminar
  onEliminar: (id: string) => Promise<void>
}

// El borrado es físico (cuenta y fila), por eso se pide confirmación
function EliminarAseguradoDialog({
  asegurado,
  onCerrar,
  onEliminar,
}: EliminarAseguradoDialogProps) {
  const [eliminando, setEliminando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmar() {
    setError(null)
    setEliminando(true)
    try {
      await onEliminar(asegurado.id)
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
      aria-labelledby="eliminar-asegurado-titulo"
    >
      <DialogTitle id="eliminar-asegurado-titulo">
        ¿Eliminar a {asegurado.nombre}?
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          Se borrará su cuenta ({asegurado.correo}, contrato{' '}
          {asegurado.idContrato}) y ya no podrá iniciar sesión. Esta acción no
          se puede deshacer.
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

export default EliminarAseguradoDialog
