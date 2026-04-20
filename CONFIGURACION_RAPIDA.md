# Configuracion rapida Cloudflare (Worker + KV + D1)

## 1) Datos que faltan completar
Solo necesitas completar estos valores en wrangler.toml:

- account_id
- kv_namespaces.id (binding SAETA_PEDIDOS)

El database_id de D1 ya esta cargado con el valor que se ve en tu captura.

## 2) Variables secretas recomendadas
Configura el token de verificacion de WhatsApp en el Worker:

wrangler secret put WHATSAPP_VERIFY_TOKEN

## 3) Crear/actualizar tabla en D1
Ejecuta el esquema SQL:

wrangler d1 execute saeta_db --file=schema.sql

## 4) Publicar Worker

wrangler deploy

## 5) Prueba de salud

https://saeta-worker-api.saetasport-py.workers.dev/api/health

## 6) Nota importante de tu frontend
Tus HTML usan esta API en varios archivos:
https://saeta-worker-api.saetasport-py.workers.dev

Si cambias el nombre del worker o dominio, actualiza API_BASE en los HTML.
