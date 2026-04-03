export function getRoomStatusLabel(status: string | null | undefined) {
  switch (status) {
    case 'available':
      return 'Tersedia'
    case 'occupied':
      return 'Terisi'
    case 'maintenance':
      return 'Perbaikan'
    default:
      return status || '-'
  }
}