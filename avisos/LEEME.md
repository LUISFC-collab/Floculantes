# Avisos de carga del parte diario

Recuerda por WhatsApp que carguen el avance: **a las 18:30 de Perú** a todos los
supervisores y después, **cada hora**, sólo a quien le falte alguna
especialidad. Con un parte cargado del día ya cuenta: a esa persona no se le
vuelve a escribir por esa especialidad.

Va por la **API oficial de WhatsApp (Meta Cloud API)** con el número de la
empresa. Sin librerías no oficiales y sin riesgo de bloqueo.

No necesita `npm install`: sólo Node 18 o superior.

## Dos cosas que conviene saber de la API, no son opinión

**No se puede escribir a un grupo.** La Cloud API sólo permite mensajes de uno a
uno. No es una limitación de este programa: Meta no expone los grupos, ni por
Twilio ni por ningún proveedor oficial. Por eso el aviso de las 18:30 sale a
cada supervisor por separado — el efecto es el mismo, todos lo reciben.

**Hay que usar plantillas aprobadas.** Para escribir *primero* (fuera de las 24 h
desde el último mensaje de esa persona) Meta exige una plantilla revisada por
ellos. Cada conversación iniciada así tiene un coste pequeño.

## Lo que hay que dar de alta una vez

En **business.facebook.com** y **developers.facebook.com**:

1. Cuenta de WhatsApp Business con el número de la empresa.
2. Anotar el **Identificador del número de teléfono** (`WA_PHONE_ID`).
3. Generar un **token permanente** de usuario de sistema (`WA_TOKEN`).
4. Crear y esperar la aprobación de **dos plantillas**:

**`carga_parte_diario`** — cuerpo con dos variables:

> Hola {{1}}, recordatorio para cargar el avance de hoy {{2}} en el aplicativo. Gracias.

**`falta_parte_diario`** — cuerpo con tres variables:

> {{1}}, aún no figura avance de hoy {{2}} en {{3}}. Cuando puedas, cárgalo en el aplicativo.

Si cambias los textos, mantén el mismo número de variables y en ese orden.

## Configuración

**`secreto.json`** (no se sube al repo). También valen variables de entorno con
los mismos nombres:

```json
{ "WA_TOKEN": "EAAG...", "WA_PHONE_ID": "123456789012345" }
```

**`config.json`**: el teléfono de cada supervisor en formato internacional sin
`+` ni espacios (`51` y los nueve dígitos) y sus especialidades. Si no existe,
se crea solo a partir de `config.ejemplo.json`.

## Uso

Ver a quién le falta — no toca WhatsApp, sólo consulta:

```bash
node avisos.mjs --ahora
```

Con `--ahora=2026-08-19` se comprueba contra un día pasado, que es la forma de
ver que la regla hace lo que debe.

Mandar **una** plantilla de prueba a un número:

```bash
node avisos.mjs --prueba=51999888777 --enviar
```

Dejarlo de guardia. Primero **en seco**: no envía nada, sólo enseña por pantalla
lo que mandaría.

```bash
node avisos.mjs
```

Cuando lo veas correcto, ya enviando de verdad:

```bash
node avisos.mjs --enviar
```

El equipo tiene que estar encendido a esas horas. Si el PC está apagado a las
18:30, ese día no sale ningún aviso.

## Qué se sube al repo y qué no

Este repositorio es **público**. Por eso quedan fuera:

- `secreto.json` — el token. Con él se puede enviar en nombre de la empresa.
- `config.json` — teléfonos de personas.
- `enviados.json` — registro de lo enviado.

En el repo sólo va `config.ejemplo.json`, sin números.

## Cómo decide a quién escribir

Consulta la tabla `partes` de Supabase: proyecto, fecha de hoy en Perú,
supervisor y disciplina. Si hay **al menos un parte** de ese supervisor en esa
especialidad ese día, no se le escribe por ella. Los **cuadres no cuentan**: son
ajustes, no la carga del día.

El registro evita repetir: el aviso de arranque sale una vez al día por persona,
y los recordatorios una vez por persona, especialidad y hora.

## Ajustes

En `config.json`:

- `horaArranque` — por defecto `18:30`.
- `horasRecuerdo` — por defecto `19:30`, `20:30`, `21:30` y `22:30`. Corta ahí a
  propósito: nadie debería recibir avisos de trabajo de madrugada.

La hora de Perú se calcula como UTC−5 fija, sin librerías: Perú no cambia la
hora en todo el año.
