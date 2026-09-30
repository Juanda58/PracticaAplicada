# Migración de Electrolineras JAMB a Supabase

## Estado actual

La aplicación incluye ahora un **panel administrativo operativo** y conserva `localStorage` como almacenamiento de la demo. La carpeta `supabase/` contiene el esquema relacional, las políticas RLS y datos semilla para que la información pueda migrarse sin rehacer el modelo de producto.

La conexión real todavía no se activa porque el proyecto no tiene configurados un `SUPABASE_URL` ni una clave pública `SUPABASE_ANON_KEY`. No se deben incrustar claves privadas o `service_role` en el navegador.

## Dónde pegar la URL y la anon key

Abre el archivo [`js/supabase-config.js`](./js/supabase-config.js) y reemplaza únicamente estos dos valores:

```js
const SUPABASE_CONFIG = {
  url: 'https://TU-PROYECTO.supabase.co',
  anonKey: 'PEGA_AQUI_TU_ANON_PUBLIC_KEY',
};
```

La URL se obtiene en **Supabase → Project Settings → API → Project URL** y la clave se obtiene en **Supabase → Project Settings → API → Project API keys → anon public**. Después de guardar el archivo, recarga la página: el panel administrativo mostrará `Supabase: Configurado` cuando los dos valores ya no sean los marcadores de ejemplo. La `anon public key` puede estar en el frontend; la `service_role key` no debe pegarse allí.

## Qué quedó preparado

| Área | Implementación en la demo | Tabla Supabase destino |
|---|---|---|
| Usuarios y roles | Inicio de sesión demo, perfiles y rol admin | `profiles` + `auth.users` |
| Electrolineras | CRUD administrativo, disponibilidad y estado | `stations` |
| Conectores | Tipo, potencia, disponibilidad y total | `station_connectors` |
| Reservas | Horario, conector, pago anticipado, estado y multa | `reservations` |
| Pagos | Método, monto, estado y referencia de proveedor | `payments` |
| Cargas | Sesión, kWh, duración y costo | `charging_sessions` |
| Historial | Actividad del usuario | `activity` |
| Patrocinadores | Marcas aliadas activas | `sponsors` |
| Trazabilidad | Acciones de aprobación, rechazo, CRUD y multas | `audit_logs` |

## Pasos de instalación

Primero se crea un proyecto en Supabase y se ejecuta [`supabase/schema.sql`](./supabase/schema.sql) en el SQL Editor. Después se ejecuta [`supabase/seed.sql`](./supabase/seed.sql) para cargar las estaciones, conectores y patrocinadores de la demo. Los usuarios se crean desde Supabase Auth, ya que `profiles.id` debe coincidir con `auth.users.id`.

Después de crear `admin@jamb.com`, se promueve la cuenta ejecutando `update public.profiles set role = 'admin', plan = 'Operador de red' where email = 'admin@jamb.com';`. La aplicación deberá usar únicamente la clave pública `anon` en el frontend; las operaciones administrativas quedan protegidas por RLS y por la función `public.is_admin()`.

## Migración de datos existentes

La demo actual guarda un objeto bajo la clave `jamb:v1`. Para migrarlo, se exportan `users`, `stations`, `activity`, `reservations`, `weightLog` y `audit` desde el navegador. Las estaciones se importan primero, luego conectores, perfiles, reservas, pagos, sesiones y actividad, respetando las relaciones. Las reservas antiguas se separan en `reservations` y `payments`; los campos `targetKwh`, `estimatedCost`, `paymentMethod`, `paymentStatus` y `penaltyCOP` se mantienen en las columnas equivalentes.

No se debe migrar el campo `password` de la demo. Cada usuario debe restablecer su contraseña mediante Supabase Auth. Tampoco se debe importar el rol admin desde datos no confiables: se asigna manualmente después de verificar la cuenta.

## Siguiente paso para activar Supabase

Para completar la migración de verdad hacen falta el **Project URL** y la **anon public key** del proyecto Supabase. Con esos dos datos se puede añadir el cliente Supabase, reemplazar las operaciones de `localStorage` en `storage.js`, conectar autenticación y hacer que el admin trabaje con datos compartidos entre usuarios. La clave `service_role` no debe compartirse ni colocarse en esta aplicación web.

## Panel administrativo

El admin ahora entra directamente a **Centro de operaciones** y tiene cinco áreas: resumen con métricas de red y facturación demo, gestión CRUD de estaciones, control de reservas y multas, usuarios registrados y auditoría. Las acciones administrativas quedan registradas localmente en `audit` y, tras activar Supabase, deben escribirse en `audit_logs`.
