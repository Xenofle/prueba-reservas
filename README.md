# Panel de reservas de estudio

Prueba técnica. Backend en Express + TypeScript (datos en memoria), frontend en React + TypeScript.

## Cómo arrancar y testear

_Pendiente de completar en la fase de andamiaje avanzado / README final (fase 9)._

## Decisiones tomadas ante ambigüedades del enunciado

Se van anotando en el momento en que se toman, no al final.

- **Búsqueda `q` (fase 2, `search.ts`):** coincidencia por **subcadena**, no por palabras sueltas. `q=alvaro` encuentra `Álvaro García` porque "alvaro" es subcadena de "alvaro garcia" una vez normalizado (sin mayúsculas ni diacríticos). Se compara `q` contra título y cliente por separado; basta con que aparezca en uno de los dos.
