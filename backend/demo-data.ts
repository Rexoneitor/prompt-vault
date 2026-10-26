/** Prompts de ejemplo para explorar la aplicación. Se marcan `is_demo` y pueden eliminarse en bloque. */

export interface DemoPrompt {
  title: string
  description: string
  content: string
  notes?: string
  category: string
  project?: string
  tool: string
  tags: string[]
  favorite?: boolean
  usageCount: number
  /** Hace cuántos días se creó. */
  createdDaysAgo: number
  /** Hace cuántos días se usó por última vez (null = nunca). */
  usedDaysAgo: number | null
  versions?: { name?: string; notes: string; content: string }[]
}

export const DEMO_PROJECTS: readonly { name: string; description: string }[] = [
  { name: 'Demo · CRM Agencia de Viajes', description: 'Prompts de ejemplo para construir un CRM.' },
  { name: 'Demo · Papelería Digital', description: 'Prompts de ejemplo para un negocio de plantillas.' },
  { name: 'Demo · Regalo Flores Amarillas', description: 'Ideas y textos para un regalo especial.' },
]

export const DEMO_PROMPTS: readonly DemoPrompt[] = [
  {
    title: 'Estrategia de lanzamiento en Instagram',
    description: 'Plan de 4 semanas para lanzar un producto con contenido orgánico.',
    category: 'Marketing',
    project: 'Demo · Papelería Digital',
    tool: 'claude',
    tags: ['lanzamiento', 'instagram', 'estrategia', 'ventas', 'contenido'],
    favorite: true,
    usageCount: 14,
    createdDaysAgo: 40,
    usedDaysAgo: 0,
    content: `Actúa como estratega de marketing digital con experiencia en lanzamientos de productos para {{audiencia}}.

Producto: {{producto}}
Objetivo del lanzamiento: {{objetivo}}
Tono de comunicación: {{tono}}

Diseña un plan de lanzamiento de 4 semanas en Instagram que incluya:
1. Fase de expectativa (semana 1): ideas de contenido que generen curiosidad sin revelar todo.
2. Fase de lanzamiento (semana 2): calendario de publicaciones, stories y reels.
3. Fase de prueba social (semana 3): cómo recopilar y mostrar testimonios.
4. Fase de cierre (semana 4): urgencia honesta y llamadas a la acción.

Para cada semana entrega una tabla con día, formato, idea de contenido y objetivo. Termina con 3 métricas clave para evaluar el resultado.`,
    notes: 'Funciona mejor si en {{objetivo}} indico una cifra concreta (ventas, registros…).',
    versions: [
      {
        name: 'Primera versión',
        notes: 'Versión inicial, sin fases.',
        content: `Actúa como experto en marketing y crea un plan de lanzamiento en Instagram para {{producto}} dirigido a {{audiencia}}.`,
      },
      {
        name: 'Con fases',
        notes: 'Añadí las cuatro fases y las métricas.',
        content: `Actúa como estratega de marketing digital. Crea un plan de lanzamiento de 4 semanas en Instagram para {{producto}} (audiencia: {{audiencia}}). Divide el plan en expectativa, lanzamiento, prueba social y cierre.`,
      },
    ],
  },
  {
    title: 'Prompt maestro para crear publicaciones',
    description: 'Genera publicaciones coherentes con la voz de la marca para cualquier red.',
    category: 'Redes sociales',
    tool: 'general',
    tags: ['contenido', 'copywriting', 'redes'],
    favorite: true,
    usageCount: 9,
    createdDaysAgo: 25,
    usedDaysAgo: 1,
    content: `Eres el community manager de una marca con este tono: {{tono}}.

Escribe 3 variantes de publicación para {{plataforma}} sobre el tema: {{tema}}.

Reglas:
- Empieza con un gancho de máximo 12 palabras.
- Un solo mensaje principal por publicación.
- Cierra con una pregunta o una llamada a la acción clara.
- Evita clichés como "en el mundo de hoy" o "te presentamos".

Entrega cada variante numerada y, debajo, sugiere una idea visual para acompañarla.`,
  },
  {
    title: 'Revisión de código con foco en seguridad',
    description: 'Revisión crítica de un fragmento de código buscando vulnerabilidades y malas prácticas.',
    category: 'Programación',
    project: 'Demo · CRM Agencia de Viajes',
    tool: 'claude-code',
    tags: ['código', 'seguridad', 'revisión'],
    usageCount: 6,
    createdDaysAgo: 18,
    usedDaysAgo: 2,
    content: `Revisa el siguiente código como un ingeniero senior de seguridad.

Lenguaje / framework: {{lenguaje}}

\`\`\`
{{codigo}}
\`\`\`

Para cada problema encontrado indica:
- Severidad (crítica, alta, media, baja)
- Qué falla y por qué es un riesgo
- Cómo corregirlo, con un ejemplo de código

Busca especialmente: inyección, validación de entradas, manejo de secretos, autorización y exposición de datos. No inventes problemas: si algo está bien, dilo.`,
  },
  {
    title: 'Especificación de una pantalla',
    description: 'Convierte una idea en una especificación clara para generar una pantalla.',
    category: 'Programación',
    project: 'Demo · CRM Agencia de Viajes',
    tool: 'lovable',
    tags: ['ui', 'especificación', 'frontend'],
    usageCount: 3,
    createdDaysAgo: 12,
    usedDaysAgo: 6,
    content: `Crea la pantalla «{{pantalla}}» para una aplicación de {{tipo_de_app}}.

Debe incluir:
- Un encabezado con el título y una acción principal visible
- Una lista filtrable con búsqueda en vivo
- Estados vacíos con un mensaje útil
- Diseño responsive (móvil primero)

Estilo: minimalista, limpio, con un solo color de acento. Prioriza la claridad sobre la decoración.`,
  },
  {
    title: 'Resumen ejecutivo de un documento',
    description: 'Resume documentos largos en puntos accionables.',
    category: 'Productividad',
    tool: 'chatgpt',
    tags: ['resumen', 'documentos'],
    usageCount: 11,
    createdDaysAgo: 60,
    usedDaysAgo: 3,
    content: `Lee el siguiente documento y entrégame un resumen ejecutivo:

1. Idea central (una frase)
2. Cinco puntos clave
3. Decisiones o acciones que se desprenden
4. Dudas o riesgos que veas

Sé conciso. Si algo no está claro en el texto, indícalo en lugar de suponerlo.

Documento:
{{documento}}`,
  },
  {
    title: 'Plan de negocio en una página',
    description: 'Estructura una idea de negocio en un plan breve y accionable.',
    category: 'Emprendimiento',
    project: 'Demo · Papelería Digital',
    tool: 'general',
    tags: ['plan', 'negocio', 'validación'],
    favorite: true,
    usageCount: 5,
    createdDaysAgo: 33,
    usedDaysAgo: 8,
    content: `Ayúdame a convertir esta idea en un plan de negocio de una página:

Idea: {{idea}}
Mercado objetivo: {{mercado}}

Incluye: problema que resuelve, cliente ideal, propuesta de valor, fuentes de ingreso, canales de adquisición, costes principales, riesgos y los tres primeros experimentos baratos para validarla esta semana.`,
  },
  {
    title: 'Retrato cinematográfico',
    description: 'Plantilla para retratos con iluminación de película.',
    category: 'Imagen',
    tool: 'midjourney',
    tags: ['retrato', 'fotografía', 'cine'],
    usageCount: 7,
    createdDaysAgo: 20,
    usedDaysAgo: 5,
    content: `cinematic portrait of {{sujeto}}, soft rim lighting, shallow depth of field, 85mm lens, film grain, muted teal and amber color grading, natural skin texture --ar 4:5 --style raw --v 7`,
  },
  {
    title: 'Investigación de mercado rápida',
    description: 'Mapa rápido de competidores, tendencias y huecos de mercado.',
    category: 'Investigación',
    tool: 'perplexity',
    tags: ['mercado', 'competencia', 'tendencias'],
    usageCount: 4,
    createdDaysAgo: 15,
    usedDaysAgo: 10,
    content: `Investiga el mercado de {{sector}} en {{region}}. Dame:

- Los 5 competidores más relevantes, con propuesta de valor y precios aproximados
- Tendencias de los últimos 12 meses (con fuentes)
- Huecos o necesidades poco atendidas

Cita cada afirmación con su fuente y distingue datos comprobados de estimaciones.`,
  },
  {
    title: 'Tutor paso a paso',
    description: 'Explica un tema comprobando la comprensión en cada paso.',
    category: 'Educación',
    tool: 'gemini',
    tags: ['aprendizaje', 'explicaciones'],
    usageCount: 2,
    createdDaysAgo: 9,
    usedDaysAgo: null,
    content: `Quiero aprender {{tema}}. Mi nivel actual es {{nivel}}.

Actúa como un tutor paciente:
1. Explica una idea a la vez, con un ejemplo cotidiano.
2. Después de cada idea, hazme una pregunta corta para comprobar que la entendí.
3. No avances hasta que responda.
4. Si me equivoco, explícalo de otra manera, sin repetir lo mismo.`,
  },
  {
    title: 'Análisis de datos de ventas',
    description: 'Interpreta una tabla de ventas y propone acciones.',
    category: 'Análisis',
    tool: 'chatgpt',
    tags: ['ventas', 'datos', 'informe'],
    usageCount: 1,
    createdDaysAgo: 7,
    usedDaysAgo: 4,
    content: `Analiza estos datos de ventas del periodo {{periodo}} y dime:

1. Qué productos o clientes concentran los ingresos
2. Qué tendencias ves respecto al periodo anterior
3. Tres anomalías que merezcan investigarse
4. Tres acciones concretas para mejorar el resultado

Muestra los cálculos clave y avisa si faltan datos para concluir algo con seguridad.

{{datos}}`,
  },
  {
    title: 'Briefing de marca',
    description: 'Cuestionario guiado para definir la identidad de una marca.',
    category: 'Diseño',
    project: 'Demo · Papelería Digital',
    tool: 'claude',
    tags: ['marca', 'identidad', 'briefing'],
    usageCount: 2,
    createdDaysAgo: 28,
    usedDaysAgo: 14,
    content: `Quiero definir la identidad de mi marca. Entrevístame con una pregunta cada vez sobre: propósito, público, personalidad, valores, competencia y sensaciones que debe transmitir.

Cuando tengas suficiente información, entrega un briefing de una página con: posicionamiento, tono de voz, palabras que sí y que no usar, y tres direcciones visuales posibles (paleta, tipografía, estilo).`,
  },
  {
    title: 'Mensaje de agradecimiento personal',
    description: 'Un mensaje cálido y sincero, sin sonar a plantilla.',
    category: 'Personal',
    project: 'Demo · Regalo Flores Amarillas',
    tool: 'general',
    tags: ['regalo', 'mensajes'],
    usageCount: 1,
    createdDaysAgo: 5,
    usedDaysAgo: 2,
    content: `Ayúdame a escribir un mensaje breve para {{persona}} que acompañe unas flores amarillas.

Lo que quiero decirle: {{motivo}}
Tono: cercano, sincero y con un toque de humor suave.

Dame tres versiones de máximo 60 palabras. Evita frases hechas.`,
  },
  {
    title: 'Guion de video corto',
    description: 'Estructura un video vertical de menos de 45 segundos.',
    category: 'Video',
    tool: 'general',
    tags: ['guion', 'reels', 'video'],
    usageCount: 0,
    createdDaysAgo: 3,
    usedDaysAgo: null,
    content: `Escribe el guion de un video vertical de máximo 45 segundos sobre {{tema}}.

Estructura: gancho (0-3 s), problema, solución en 3 pasos, cierre con llamada a la acción.

Entrega una tabla con tres columnas: tiempo, lo que se dice y lo que se ve en pantalla.`,
  },
]
