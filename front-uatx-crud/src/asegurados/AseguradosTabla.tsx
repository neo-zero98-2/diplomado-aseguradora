import {
  Button,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { formatearFecha } from '../utils/fechas.ts'
import type { Asegurado } from './types.ts'

interface AseguradosTablaProps {
  asegurados: Asegurado[]
  // Mientras no se conecten (pasos 11 y 12) los botones se muestran deshabilitados
  onEditar?: (asegurado: Asegurado) => void
  onEliminar?: (asegurado: Asegurado) => void
}

function AseguradosTabla({
  asegurados,
  onEditar,
  onEliminar,
}: AseguradosTablaProps) {
  return (
    // En pantallas chicas la tabla se desplaza en horizontal dentro del Paper
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Asegurados" sx={{ minWidth: 760 }}>
        <TableHead>
          <TableRow>
            <TableCell>Nombre</TableCell>
            <TableCell align="right">Edad</TableCell>
            <TableCell>idContrato</TableCell>
            <TableCell>Vencimiento</TableCell>
            <TableCell>Correo</TableCell>
            <TableCell align="right">Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {asegurados.map((asegurado) => (
            <TableRow key={asegurado.id} hover>
              <TableCell>{asegurado.nombre}</TableCell>
              <TableCell align="right">{asegurado.edad}</TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {asegurado.idContrato}
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {formatearFecha(asegurado.fechaVencimiento)}
              </TableCell>
              <TableCell sx={{ wordBreak: 'break-all' }}>
                {asegurado.correo}
              </TableCell>
              <TableCell align="right">
                <Stack
                  direction="row"
                  spacing={1}
                  sx={{ justifyContent: 'flex-end' }}
                >
                  <Button
                    size="small"
                    disabled={!onEditar}
                    onClick={() => onEditar?.(asegurado)}
                    aria-label={`Editar a ${asegurado.nombre}`}
                  >
                    Editar
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    disabled={!onEliminar}
                    onClick={() => onEliminar?.(asegurado)}
                    aria-label={`Eliminar a ${asegurado.nombre}`}
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

export default AseguradosTabla
