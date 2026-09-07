// Editorial fixtures for the explicitly identified demonstration edition.
export const authors = [
  { id: 'elena-rivas', name: 'Elena Rivas', bio: 'Perfil de demostración. Escribe sobre lectura, bibliotecas y cultura cotidiana.' },
  { id: 'mateo-salinas', name: 'Mateo Salinas', bio: 'Perfil de demostración. Observa la ciudad a pie y cuenta las historias de sus espacios.' },
  { id: 'maria-paredes', name: 'María Paredes', bio: 'Perfil de demostración. Explora la escritura, los procesos creativos y el aprendizaje.' },
  { id: 'lucas-grau', name: 'Lucas Grau', bio: 'Perfil de demostración. Investiga cómo diseñar herramientas digitales más claras.' },
]

export const publicationTypes = ['Artículo', 'Opinión', 'Análisis', 'Reseña', 'Noticia', 'Crónica', 'Guía']
export const categories = ['Cultura', 'Ciudad', 'Tecnología', 'Escritura']
const paragraph = (text) => ({ type: 'paragraph', text })
const heading = (text) => ({ type: 'heading', text })
const quote = (text) => ({ type: 'quote', text })

export const articles = [
  {
    slug: 'leer-sin-prisa', type: 'Artículo', category: 'Cultura',
    title: 'Leer también es una forma de quedarse.',
    summary: 'Entre páginas y pausas, una invitación a recuperar la atención y encontrar un ritmo propio.',
    authorId: 'elena-rivas', date: '2026-09-06', image: '/images/lectura.webp',
    imageAlt: 'Una persona de suéter verde leyendo en una biblioteca', tags: ['lectura', 'atención'],
    blocks: [
      paragraph('Abrir un libro puede parecer un gesto pequeño. Sin embargo, reservarle un tiempo sin interrupciones cambia la manera de habitar una tarde. La lectura no pide velocidad: pide un lugar al que podamos volver.'),
      heading('Una pausa que no exige resultados'),
      paragraph('No todas las páginas necesitan convertirse en una nota, una recomendación o una meta cumplida. A veces basta con seguir una voz y permitir que una frase nos acompañe después de cerrar el libro.'),
      quote('Leer sin prisa es aceptar que algunas ideas necesitan quedarse un rato.'),
      heading('Encontrar el propio ritmo'),
      paragraph('Dejar un señalador en la mesa, elegir un asiento cómodo y silenciar las notificaciones son gestos sencillos. No garantizan una tarde perfecta, pero crean las condiciones para prestarle atención a una historia.'),
    ],
  },
  {
    slug: 'ciudad-a-pie', type: 'Crónica', category: 'Ciudad',
    title: 'La ciudad que aparece cuando caminamos.',
    summary: 'Una caminata imaginada por las calles de Sucre, entre fachadas, sombras y conversaciones.',
    authorId: 'mateo-salinas', date: '2026-09-05', image: '/images/ciudad.webp',
    imageAlt: 'Una calle de Sucre con fachadas blancas, tejas y una puerta azul', tags: ['Sucre', 'caminar'],
    blocks: [
      paragraph('En esta crónica de demostración, el recorrido empieza sin una lista de lugares. La primera esquina ofrece una franja de sombra; la siguiente, el sonido de una conversación que sale de una ventana.'),
      heading('Mirar a la altura de la calle'),
      paragraph('Desde la acera se ven las capas pequeñas de una ciudad: la pintura que se renueva, una puerta que conserva sus marcas y las plantas que alguien riega antes de abrir su negocio.'),
      quote('Una ciudad no se termina de conocer: se vuelve a mirar.'),
      heading('Volver por otra ruta'),
      paragraph('El regreso cambia con la luz. La misma pared ya no parece la misma. Caminar despacio deja esa posibilidad: descubrir diferencias en un trayecto que creíamos agotado.'),
    ],
  },
  {
    slug: 'escribir-para-alguien', type: 'Opinión', category: 'Escritura',
    title: 'Escribir para alguien, no para una cifra.',
    summary: 'Por qué una conversación honesta vale más que perseguir una reacción inmediata.',
    authorId: 'maria-paredes', date: '2026-09-04', image: '/images/escritura.webp',
    imageAlt: 'Un cuaderno abierto junto a libros y una taza de café', tags: ['escritura', 'edición'],
    blocks: [
      paragraph('Creo que un texto encuentra su fuerza cuando sabe a quién quiere hablarle. Eso no significa reducir sus posibilidades, sino imaginar una persona con preguntas concretas al otro lado de la página.'),
      heading('La claridad como decisión editorial'),
      paragraph('Un título puede despertar curiosidad sin esconder lo que promete. Un párrafo puede ser sencillo sin renunciar a la precisión. Revisar consiste también en retirar lo que solo está ahí para llamar la atención.'),
      quote('Publicar no termina una conversación; puede ser la manera de empezarla.'),
      paragraph('Las cifras pueden ayudar a conocer la recepción de un texto. Mi propuesta es no dejar que el tamaño de esa recepción decida, por sí solo, qué merece ser escrito.'),
    ],
  },
  {
    slug: 'interfaces-con-menos-ruido', type: 'Análisis', category: 'Tecnología',
    title: 'Menos ruido, mejores decisiones.',
    summary: 'Una lectura del diseño de interfaces a través de tres preguntas sobre atención, jerarquía y propósito.',
    authorId: 'lucas-grau', date: '2026-09-03', image: '/images/escritura.webp',
    imageAlt: 'Una mesa de trabajo con cuaderno, libros y luz de ventana', tags: ['diseño', 'interfaces'],
    blocks: [
      paragraph('Una interfaz editorial tiene una tarea central: ayudar a encontrar y leer contenido. Cada elemento adicional compite con esa tarea. Podemos analizar su utilidad preguntando qué decisión facilita y en qué momento aparece.'),
      heading('Jerarquía antes que decoración'),
      paragraph('Si el título, la navegación y los controles de cuenta tienen el mismo peso, el lector debe construir la jerarquía por su cuenta. El tamaño, el espacio y el contraste pueden hacer visible esa relación.'),
      heading('Controles con consecuencias claras'),
      paragraph('Guardar y compartir no son lo mismo. Nombrar cada acción y confirmar su resultado reduce la incertidumbre. Cuando una petición falla, el mensaje debe explicar cómo volver a intentarlo sin fingir que funcionó.'),
      paragraph('El análisis no exige eliminar todos los elementos. Exige justificar su presencia y comprobar que el recorrido sigue siendo comprensible con teclado, en una pantalla pequeña y sin animaciones.'),
    ],
  },
  {
    slug: 'cuaderno-de-los-dias', type: 'Reseña', category: 'Cultura',
    title: 'Un cuaderno para mirar lo cotidiano.',
    summary: 'Reseña de una publicación imaginaria: fragmentos breves que dejan espacio al lector.',
    authorId: 'elena-rivas', date: '2026-09-02', image: '/images/lectura.webp',
    imageAlt: 'Una persona leyendo junto a estanterías de una biblioteca', tags: ['reseñas', 'libros'],
    blocks: [
      paragraph('Cuaderno de los días es un libro ficticio creado para esta edición de muestra. Su propuesta combina escenas breves y páginas de notas: una cocina al amanecer, una espera en la plaza, una conversación pendiente.'),
      heading('Lo que funciona'),
      paragraph('La estructura fragmentaria permite entrar por distintas páginas. Cada escena se sostiene por una imagen concreta y evita explicar demasiado, de modo que el lector puede completar sus silencios.'),
      heading('Lo que deja abierto'),
      paragraph('Esa brevedad también limita el desarrollo de algunas voces. Quien busque una trama continua puede sentir que el libro se interrumpe justo cuando una historia empieza a tomar forma.'),
      paragraph('Dentro de este ejercicio editorial, lo recomendaría a lectores interesados en la observación y en formatos que admiten una lectura discontinua.'),
    ],
  },
  {
    slug: 'mesa-de-lectura-abierta', type: 'Noticia', category: 'Cultura',
    title: 'Una mesa abierta para compartir lecturas.',
    summary: 'Noticia ficticia de demostración: un encuentro vecinal propone conversar a partir de una página.',
    authorId: 'mateo-salinas', date: '2026-09-01', image: '/images/ciudad.webp',
    imageAlt: 'Calle tranquila de fachadas claras y techos de teja', tags: ['comunidad', 'lectura'],
    blocks: [
      paragraph('Esta noticia es ficticia y no anuncia un evento real. En el escenario de demostración, un grupo vecinal organiza una mesa de lectura donde cada participante lleva un fragmento breve para compartir.'),
      heading('Una página como punto de partida'),
      paragraph('La dinámica propuesta comienza con lecturas de pocos minutos y continúa con una conversación. No se requiere haber leído un mismo libro ni preparar una exposición.'),
      paragraph('El ejemplo permite mostrar cómo otherbloc distingue una noticia de una opinión o una guía. Las fechas, los lugares y los organizadores de una noticia real deben comprobarse antes de publicarla.'),
    ],
  },
  {
    slug: 'primer-borrador', type: 'Guía', category: 'Escritura',
    title: 'Del apunte al primer borrador.',
    summary: 'Un recorrido breve para organizar una idea, escribirla y revisarla sin perder su intención.',
    authorId: 'maria-paredes', date: '2026-08-31', image: '/images/escritura.webp',
    imageAlt: 'Libros, café y un cuaderno dispuesto para escribir', tags: ['guía', 'borradores'],
    blocks: [
      paragraph('Un borrador no necesita resolverlo todo. Su función es darle una forma provisional a una idea para que puedas discutirla, reorganizarla y mejorarla.'),
      heading('Preparar una dirección'),
      { type: 'list', items: ['Escribe en una frase qué quieres contar.', 'Anota las preguntas que podría tener tu lector.', 'Reúne ejemplos y distingue observaciones de datos por verificar.'] },
      heading('Escribir y volver a leer'),
      paragraph('Trabaja primero en el recorrido completo. Después revisa si cada párrafo aporta algo distinto. Leer en voz alta puede ayudarte a encontrar frases demasiado largas o conexiones que faltan.'),
      quote('El primer borrador es un lugar de trabajo, no un examen.'),
      paragraph('Antes de compartirlo, comprueba el título, las fuentes cuando correspondan y los textos alternativos de las imágenes. Guarda una versión recuperable para continuar con calma.'),
    ],
  },
].map((article) => ({
  ...article,
  author: authors.find((author) => author.id === article.authorId).name,
  readTime: Math.max(1, Math.ceil(article.blocks.map((block) => block.text ?? block.items?.join(' ') ?? '').join(' ').split(/\s+/).length / 200)) + ' min de lectura',
  demo: true,
}))

export const normalizeSearch = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

export function filterArticles(items, { category = '', type = '', query = '' } = {}) {
  const search = normalizeSearch(query)
  return items.filter((article) =>
    (!category || normalizeSearch(article.category) === normalizeSearch(category)) &&
    (!type || article.type === type) &&
    (!search || normalizeSearch([article.title, article.summary, article.author, ...article.tags].join(' ')).includes(search)),
  )
}
