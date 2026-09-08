# dolar-alertas

Avisos automáticos por **email, Telegram y/o WhatsApp**, para vos y para quien quieras sumar:

| Aviso | Cuándo | Qué manda |
|---|---|---|
| 🟢 Apertura | días hábiles, 11:30 ART | oficial y blue (compra/venta), brecha y variación contra el cierre anterior |
| 🔴 Cierre | días hábiles, 18:15 ART | lo mismo, con la variación del día |
| ⚡ Salto | días hábiles, se mira cada 20 min de 11:00 a 18:00 | sólo si el dólar se movió fuerte dentro del día |
| 🏗️ Índice CAC | una vez por mes, cuando CAMARCO publica | costo de la construcción: nivel general, materiales y mano de obra |

Todo corre en **GitHub Actions** (gratis en repos públicos) y usa **APIs públicas argentinas**, sin claves ni cuentas pagas.

---

## Fuentes de datos

- **Dólar:** [dolarapi.com](https://dolarapi.com) (principal) con respaldo automático en [argentinadatos.com](https://argentinadatos.com). Gratis, sin API key.
- **Índice CAC:** CAMARCO lo publica en PDF una vez por mes, entre el 20 y el 25, y **no tiene API oficial**. Se leen dos réplicas públicas y se combinan: `calculadoracac.com.ar` (variaciones con dos decimales y fecha de la próxima publicación) y `factibilia.com` (valores absolutos del índice, los que se usan para actualizar contratos). Si una se cae, alcanza con la otra; si cambian las dos el workflow falla y avisa por GitHub.

---

## Puesta en marcha

### 1. Subir el repo a GitHub

```bash
cd ~/Desktop/dolar-alertas
gh repo create dolar-alertas --public --source=. --push
```

### 2. Elegir un proveedor de email

Cualquiera de los dos, no hacen falta los dos:

- **Brevo** — el más rápido de arrancar: 300 mails por día gratis y alcanza con validar tu casilla como remitente. Sacás la key en `brevo.com` → SMTP & API → API Keys.
- **Resend** — 3.000 mails por mes gratis, pero necesita un dominio propio verificado (te sirve cualquiera de los que ya tenés).

### 3. Elegir el canal de celular

Hay dos caminos y el código habla los dos. **Telegram es el recomendado**: gratis de verdad, sin límites, sin aprobaciones y se configura en tres minutos.

**Telegram**

1. Escribirle a [@BotFather](https://t.me/BotFather), mandarle `/newbot` y ponerle nombre. Devuelve un **token**: ese es `TELEGRAM_BOT_TOKEN`.
2. Cada persona que vaya a recibir avisos le manda un `hola` al bot (si no, Telegram no deja escribirle primero).
3. Correr `TELEGRAM_BOT_TOKEN=... node bin/chats.mjs` para ver los **chat id** y pegarlos en el campo `telegram` de cada destinatario.

**WhatsApp (Cloud API de Meta)**

Es el WhatsApp de verdad, pero tiene tres condiciones: número de WhatsApp Business conectado a Meta, **plantilla aprobada** (un mensaje que inicia la empresa fuera de la ventana de 24 h no puede ser texto libre) y **costo por mensaje** — en Argentina ronda USD 0,012 la plantilla de utilidad, o sea unos pocos dólares al mes con este volumen.

Si ya tenés una WABA andando (por ejemplo la de Zafo), alcanza con reusar su `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` y crear una plantilla nueva, categoría **Utility**, idioma **es**, con este cuerpo:

```
Alerta automática de {{1}}.

{{2}}

Datos al {{3}}. Este aviso lo configuraste vos; para darlo de baja, respondé este mensaje.
```

Las tres variables las llena el código y ninguna lleva saltos de línea, que es lo que Meta rechaza. Si le ponés otro nombre a la plantilla, cargalo en la variable `WHATSAPP_PLANTILLA`.

> Twilio sigue soportado como tercera opción: `TWILIO_SID`, `TWILIO_TOKEN` y `TWILIO_FROM`.

### 4. Cargar los secretos en GitHub

En **Settings → Secrets and variables → Actions → New repository secret**:

| Secreto | Obligatorio | Valor |
|---|---|---|
| `DESTINATARIOS` | sí | el JSON de acá abajo |
| `BREVO_API_KEY` *o* `RESEND_API_KEY` | para email | la key del proveedor |
| `MAIL_FROM` | para email | la casilla remitente verificada |
| `TELEGRAM_BOT_TOKEN` | para Telegram | el token de BotFather |
| `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID` | para WhatsApp | credenciales de la Cloud API de Meta |
| `TWILIO_SID` / `TWILIO_TOKEN` / `TWILIO_FROM` | no | sólo si usás Twilio |

`DESTINATARIOS` es un array JSON, en una sola línea o en varias:

```json
[
  { "nombre": "Ezequiel", "email": "vos@mail.com",  "telegram": "123456789" },
  { "nombre": "Fulano",   "email": "otro@mail.com", "telegram": "987654321", "whatsapp": "+5493412222222" }
]
```

Todos los campos menos `nombre` son opcionales: quien tenga sólo `email` recibe sólo mail, y quien tenga `telegram` y `whatsapp` recibe por los dos. Se puede limitar a qué avisos se suscribe cada uno:

```json
{ "nombre": "Fulano", "email": "otro@mail.com", "solo": ["cierre", "cac"] }
```

Los tipos válidos son `apertura`, `cierre`, `salto` y `cac`.

### 5. Probar

En la pestaña **Actions**, cada workflow tiene el botón **Run workflow** para dispararlo a mano. Empezá por *Dólar · apertura*: si llega el mail y el WhatsApp, ya está todo bien.

---

## Ajustar los umbrales

En [`config.json`](config.json):

```json
{
  "saltos": {
    "umbralOficial": 1.0,
    "umbralBlue": 1.5,
    "minutosEntreAvisos": 45,
    "maximoPorDia": 4
  }
}
```

Un salto se mide **contra el ancla del día**, que arranca en la apertura y se vuelve a fijar después de cada aviso: así el aviso siguiente mide el movimiento nuevo y no repite el mismo. Además hay 45 minutos mínimos entre avisos y un tope de 4 por día, para que un día muy movido no te llene el teléfono.

---

## Probar en tu máquina, sin enviar nada

```bash
node bin/probar.mjs
```

Trae los datos reales de hoy, imprime los cuatro mensajes (el texto completo que va por Telegram y las tres variables que van por la plantilla de WhatsApp) y deja los HTML de los mails en `vista-previa/` para abrirlos en el navegador.

Para simular un envío completo sin mandar nada:

```bash
DRY_RUN=1 FORZAR=1 DESTINATARIOS='[{"nombre":"yo","email":"yo@mail.com"}]' node bin/diario.mjs cierre
```

- `DRY_RUN=1` imprime en pantalla en lugar de enviar y no toca los archivos de estado.
- `FORZAR=1` saltea los controles de día hábil y de "esto ya se avisó".

---

## Cómo está armado

```
bin/diario.mjs      apertura y cierre
bin/intradia.mjs    detección de saltos
bin/cac.mjs         índice CAC (avisa sólo si hay período nuevo)
bin/probar.mjs      vista previa sin enviar
bin/chats.mjs       chat id de Telegram de quien le escribió al bot

src/fuentes/        dólar y CAC
src/canales/        email (Resend/Brevo), Telegram y WhatsApp (Meta/Twilio)
src/plantillas.js   HTML de los mails y texto de WhatsApp
src/estado.js       lectura y escritura de data/

data/estado.json    última apertura, cierre, ancla, saltos del día, último CAC avisado
data/historial.json serie diaria (viene sembrada con 800 días reales)
data/cac.json       cada índice CAC que se fue publicando
```

Los workflows commitean `data/` después de correr: ahí queda el registro de todo lo avisado y la serie que alimenta el panel.

## Detalles que conviene saber

- **Argentina es UTC-3 todo el año**, así que los cron en UTC no se corren con el horario de verano. Toda fecha se calcula con `Intl` en `America/Argentina/Buenos_Aires` — nunca con `toISOString().slice(0,10)`, que de las 21:00 en adelante adelanta un día.
- **GitHub Actions puede demorar los cron** unos minutos cuando está cargado; para estos avisos no cambia nada.
- **La primera corrida del CAC avisa enseguida** con el último período publicado, aunque no sea nuevo. Es a propósito: sirve de confirmación de que el circuito funciona. A partir de ahí, uno por mes.
- Si el fin de semana no hay rueda, los avisos de dólar no se mandan.
