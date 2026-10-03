import { Box, Typography } from '@mui/material'
import AppHeader from '../components/AppHeader.tsx'

// La tabla y los diálogos del CRUD llegan en los pasos 10 a 12 de la SPEC 02
function AseguradosPage() {
  return (
    <>
      <AppHeader />
      <Box sx={{ maxWidth: 1100, mx: 'auto', p: { xs: 2, md: 4 } }}>
        <Typography variant="h5" component="h2">
          Asegurados
        </Typography>
      </Box>
    </>
  )
}

export default AseguradosPage
