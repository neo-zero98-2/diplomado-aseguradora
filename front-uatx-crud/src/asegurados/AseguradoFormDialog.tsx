import { useState, type FormEvent } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
} from '@mui/material'
import type {
  ActualizarAseguradoDto,
  Asegurado,
  CrearAseguradoDto,
} from './types.ts'

interface Campos {
  nombre: string
  edad: string
  idContrato: string
  fechaVencimiento: string
  correo: string
  contrasena: string
}

type Errores = Partial<Record<keyof Campos, string>>

interface AseguradoFormDialogProps {
  // Sin asegurado es modo crear (pide contraseña); con asegurado, modo editar
  asegurado?: Asegurado
  onCerrar: () => void
  // Lanza un Error con el mensaje a mostrar (p. ej. el 400/409 del backend)
  onCrear: (dto: CrearAseguradoDto) => Promise<void>
  onActualizar: (id: string, dto: ActualizarAseguradoDto) => Promise<void>
}

function camposDe(asegurado?: Asegurado): Campos {
  return {
    nombre: asegurado?.nombre ?? '',
    edad: asegurado ? String(asegurado.edad) : '',
    idContrato: asegurado?.idContrato ?? '',
    fechaVencimiento: asegurado?.fechaVencimiento ?? '',
    correo: asegurado?.correo ?? '',
    contrasena: '',
  }
}

// Las mismas reglas que valida el backend, para avisar antes de enviar
function validar(campos: Campos, creando: boolean): Errores {
  const errores: Errores = {}
  if (!campos.nombre.trim()) errores.nombre = 'Escribe el nombre'
  if (!/^\d+$/.test(campos.edad) || Number(campos.edad) <= 0) {
    errores.edad = 'La edad debe ser un número entero mayor que 0'
  }
  if (!campos.idContrato.trim()) errores.idContrato = 'Escribe el idContrato'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.fechaVencimiento)) {
    errores.fechaVencimiento = 'Elige la fecha de vencimiento'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(campos.correo.trim())) {
    errores.correo = 'Escribe un correo válido'
  }
  if (creando && campos.contrasena.length < 6) {
    errores.contrasena = 'La contraseña debe tener al menos 6 caracteres'
  }
  return errores
}

function AseguradoFormDialog({
  asegurado,
  onCerrar,
  onCrear,
  onActualizar,
}: AseguradoFormDialogProps) {
  const creando = !asegurado
  const [campos, setCampos] = useState<Campos>(() => camposDe(asegurado))
  const [errores, setErrores] = useState<Errores>({})
  const [errorServidor, setErrorServidor] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  function cambiar(campo: keyof Campos, valor: string) {
    setCampos((actuales) => ({ ...actuales, [campo]: valor }))
    setErrores((actuales) => ({ ...actuales, [campo]: undefined }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const nuevosErrores = validar(campos, creando)
    setErrores(nuevosErrores)
    if (Object.keys(nuevosErrores).length > 0) return

    const datos = {
      nombre: campos.nombre.trim(),
      edad: Number(campos.edad),
      idContrato: campos.idContrato.trim(),
      fechaVencimiento: campos.fechaVencimiento,
      correo: campos.correo.trim(),
    }

    setErrorServidor(null)
    setGuardando(true)
    try {
      if (creando) {
        await onCrear({ ...datos, contrasena: campos.contrasena })
      } else {
        // PATCH solo con los campos que cambiaron
        const cambios: ActualizarAseguradoDto = {}
        for (const clave of Object.keys(datos) as (keyof typeof datos)[]) {
          if (datos[clave] !== asegurado[clave]) {
            Object.assign(cambios, { [clave]: datos[clave] })
          }
        }
        if (Object.keys(cambios).length > 0) {
          await onActualizar(asegurado.id, cambios)
        }
      }
      onCerrar()
    } catch (err) {
      // El diálogo sigue abierto para corregir los datos
      setErrorServidor(
        err instanceof Error ? err.message : 'Ocurrió un error inesperado',
      )
      setGuardando(false)
    }
  }

  const propsCampo = (campo: keyof Campos) => ({
    value: campos[campo],
    onChange: (e: { target: { value: string } }) =>
      cambiar(campo, e.target.value),
    error: !!errores[campo],
    helperText: errores[campo],
    required: true,
    fullWidth: true,
  })

  return (
    <Dialog
      open
      onClose={guardando ? undefined : onCerrar}
      fullWidth
      maxWidth="sm"
      aria-labelledby="asegurado-form-titulo"
    >
      <form onSubmit={handleSubmit} noValidate>
        <DialogTitle id="asegurado-form-titulo">
          {creando ? 'Nuevo asegurado' : 'Editar asegurado'}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField label="Nombre" autoFocus {...propsCampo('nombre')} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5}>
              <TextField
                label="Edad"
                type="number"
                slotProps={{ htmlInput: { min: 1, step: 1 } }}
                {...propsCampo('edad')}
              />
              <TextField label="idContrato" {...propsCampo('idContrato')} />
            </Stack>
            <TextField
              label="Fecha de vencimiento"
              type="date"
              slotProps={{ inputLabel: { shrink: true } }}
              {...propsCampo('fechaVencimiento')}
            />
            <TextField
              label="Correo"
              type="email"
              autoComplete="off"
              {...propsCampo('correo')}
            />
            {creando && (
              <TextField
                label="Contraseña inicial"
                type="password"
                autoComplete="new-password"
                {...propsCampo('contrasena')}
              />
            )}
            {errorServidor && <Alert severity="error">{errorServidor}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Button>
          <Button type="submit" variant="contained" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

export default AseguradoFormDialog
