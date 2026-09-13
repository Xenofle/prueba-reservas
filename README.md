# Panel de reservas de estudio

Prueba técnica. Backend en Express + TypeScript (datos en memoria), frontend en React + TypeScript.

## Cómo arrancar y testear

_Pendiente de completar en la fase de andamiaje avanzado / README final (fase 9)._

## Decisiones tomadas ante ambigüedades del enunciado

Se van anotando en el momento en que se toman, no al final.

- **Búsqueda `q` (fase 2, `search.ts`):** coincidencia por **subcadena**, no por palabras sueltas. `q=alvaro` encuentra `Álvaro García` porque "alvaro" es subcadena de "alvaro garcia" una vez normalizado (sin mayúsculas ni diacríticos). Se compara `q` contra título y cliente por separado; basta con que aparezca en uno de los dos.
- **Formato del cursor (fase 2, `cursor.ts`):** base64 estándar (no url-safe) del JSON compacto `{"start":"<ISO-UTC>","id":"<id>"}`. Es opaco para el cliente: solo se decodifica en el servidor. La comparación para paginar ordena por `(start, id)` como tupla, así que dos reservas con el mismo `start` se desempatan por `id` sin saltos ni repeticiones al recorrer todas las páginas.
