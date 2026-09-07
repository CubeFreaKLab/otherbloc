export const categories = ['Cultura', 'Ciudad', 'Tecnología', 'Escritura']
export const normalizeSearch = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
