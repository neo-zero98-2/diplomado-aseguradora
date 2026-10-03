import { Avatar, Box, Paper, Stack, Typography } from '@mui/material'
import type { Perfil } from '../auth/types.ts'

// Iniciales del nombre y del primer apellido: "María López" -> "ML"
function iniciales(nombre: string) {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')
}

// 'YYYY-MM-DD' -> 'DD/MM/YYYY' sin pasar por Date (evita el desfase de zona horaria)
function formatearFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-')
  return `${dia}/${mes}/${anio}`
}

function filasDe(perfil: Perfil): [string, string][] {
  const comunes: [string, string][] = [
    ['Nombre', perfil.nombre],
    ['Edad', `${perfil.edad} años`],
  ]
  if (perfil.rol === 'asegurado') {
    return [
      ...comunes,
      ['idContrato', perfil.idContrato],
      ['Fecha de vencimiento', formatearFecha(perfil.fechaVencimiento)],
      ['Fecha de registro', formatearFecha(perfil.fechaRegistro)],
      ['Correo', perfil.correo],
    ]
  }
  return [
    ...comunes,
    ['idEmpleado', perfil.idEmpleado],
    ['Correo', perfil.correo],
  ]
}

function DatosPersonales({ perfil }: { perfil: Perfil }) {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" component="h2" align="center" gutterBottom>
        Datos personales
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
        <Avatar sx={{ width: 96, height: 96, fontSize: 36 }}>
          {iniciales(perfil.nombre)}
        </Avatar>
      </Box>
      <Stack component="dl" spacing={1.5} sx={{ m: 0 }}>
        {filasDe(perfil).map(([etiqueta, valor]) => (
          <Box key={etiqueta}>
            <Typography
              component="dt"
              variant="caption"
              color="text.secondary"
            >
              {etiqueta}
            </Typography>
            <Typography component="dd" sx={{ m: 0, wordBreak: 'break-word' }}>
              {valor}
            </Typography>
          </Box>
        ))}
      </Stack>
    </Paper>
  )
}

export default DatosPersonales
