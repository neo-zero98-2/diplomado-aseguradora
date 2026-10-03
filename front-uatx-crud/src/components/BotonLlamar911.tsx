import { useState } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material'

// Pide confirmación antes de marcar para evitar llamadas accidentales
function BotonLlamar911() {
  const [abierto, setAbierto] = useState(false)

  function llamar() {
    setAbierto(false)
    window.location.href = 'tel:911'
  }

  return (
    <>
      <Button
        variant="contained"
        color="error"
        size="large"
        fullWidth
        onClick={() => setAbierto(true)}
        sx={{ py: 2, fontWeight: 'bold' }}
      >
        Llamar al 911
      </Button>
      <Dialog open={abierto} onClose={() => setAbierto(false)}>
        <DialogTitle>¿Llamar al 911?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Se abrirá la aplicación de teléfono para marcar al 911. Si no se
            abre, marca el número directamente.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAbierto(false)}>Cancelar</Button>
          <Button color="error" variant="contained" onClick={llamar}>
            Llamar
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default BotonLlamar911
