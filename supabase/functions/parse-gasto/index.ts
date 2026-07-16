// Recibe una captura de pantalla (o texto) de transacciones de gastos (ej.
// Google Pay) y usa Gemini para extraer una LISTA de gastos (puede traer
// varios, como el historial de actividad) con monto, descripción, fecha y
// una categoría sugerida. La API key de Gemini vive solo aquí (secret de
// servidor) y nunca llega al navegador.

// gemini-2.5-flash-lite ya no está disponible para cuentas nuevas (404 en
// generateContent aunque siga listado en /models). 3.1-flash-lite es el
// equivalente actual verificado contra esta API key.
const GEMINI_MODEL = 'gemini-3.1-flash-lite'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

interface Categoria {
  id: string
  nombre: string
}

interface GastoExtraido {
  monto: number
  descripcion: string
  fecha: string
  category_id: string | null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  let body: { image?: string; text?: string; categorias?: Categoria[] }
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'JSON inválido' }, 400)
  }

  const { image, text, categorias = [] } = body

  if (!image && !text) {
    return jsonResponse({ error: 'Falta imagen o texto' }, 400)
  }

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) {
    return jsonResponse({ error: 'GEMINI_API_KEY no configurada en el proyecto' }, 500)
  }

  const categoriasTexto = categorias.length > 0
    ? categorias.map(c => `- ${c.nombre} (id: ${c.id})`).join('\n')
    : 'Sin categorías disponibles'

  const parts: Record<string, unknown>[] = [{
    text:
      'Esta es una captura de pantalla o texto de gastos personales (ej. Google Pay). ' +
      'Puede contener UNA sola transacción o VARIAS (como una lista de actividad/historial). ' +
      'Identifica CADA transacción de gasto por separado y devuelve una lista con todas. ' +
      'Para cada una extrae: el monto (solo número, sin símbolo de moneda), una descripción corta ' +
      'del comercio o concepto, la fecha en formato YYYY-MM-DD (si no aparece, usa hoy: ' +
      `${new Date().toISOString().slice(0, 10)}), y la categoría más apropiada según el comercio, ` +
      `eligiendo SOLO de esta lista:\n${categoriasTexto}\n\n` +
      'Responde category_id con el id exacto de la lista, o null si ninguna aplica bien. ' +
      'Ignora transferencias entre cuentas propias, recargas o movimientos que no sean gastos claros. ' +
      'Si no detectas ningún gasto, responde una lista vacía.',
  }]

  if (text) parts.push({ text: `Texto de la transacción:\n${text}` })

  if (image) {
    const match = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(image)
    if (!match) return jsonResponse({ error: 'Formato de imagen inválido' }, 400)
    parts.push({ inlineData: { mimeType: match[1], data: match[2] } })
  }

  let geminiRes: Response
  try {
    geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                monto: { type: 'NUMBER' },
                descripcion: { type: 'STRING' },
                fecha: { type: 'STRING' },
                category_id: { type: 'STRING', nullable: true },
              },
              required: ['monto', 'descripcion', 'fecha'],
            },
          },
        },
      }),
    })
  } catch (err) {
    console.error('Error llamando a Gemini:', err)
    return jsonResponse({ error: 'No se pudo contactar a Gemini' }, 502)
  }

  if (!geminiRes.ok) {
    console.error('Gemini respondió con error:', await geminiRes.text())
    return jsonResponse({ error: 'Gemini no pudo procesar la captura' }, 502)
  }

  const geminiData = await geminiRes.json()
  const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text
  if (!rawText) return jsonResponse({ error: 'Respuesta vacía de Gemini' }, 502)

  let gastos: GastoExtraido[]
  try {
    const parsed = JSON.parse(rawText)
    gastos = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return jsonResponse({ error: 'Gemini devolvió un formato inesperado' }, 502)
  }

  // No confiar ciegamente en el category_id sugerido: debe ser una de las
  // categorías reales que mandó el cliente.
  const idsValidos = new Set(categorias.map(c => c.id))
  for (const g of gastos) {
    if (g.category_id && !idsValidos.has(g.category_id)) {
      g.category_id = null
    }
  }

  return jsonResponse(gastos)
})
