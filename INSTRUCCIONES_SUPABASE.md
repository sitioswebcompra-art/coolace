# Configuración de CoolAceGest

CoolAceGest usa Supabase para guardar la operación y **Supabase Auth** para iniciar sesión. Las contraseñas no se guardan en tablas de la aplicación. Los datos se protegen mediante Row Level Security (RLS).

## 1. Configurar el proyecto

1. En Supabase, abre el proyecto que utilizará la aplicación.
2. En **Project Settings > API**, copia la Project URL y la clave pública `anon`/`publishable`.
3. Guarda esos valores en el archivo local `.env`:

   ```env
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<clave-publica-del-proyecto>
   ```

   La URL debe ser la URL del proyecto, no `https://supabase.com`. Nunca pongas una clave `service_role` en el navegador ni la compartas.

## 2. Aplicar el esquema y la seguridad

1. Abre **SQL Editor** en el mismo proyecto de Supabase.
2. Copia el contenido completo de `database.sql` y ejecútalo.
3. El script es una migración aditiva para conservar clientes, vehículos y órdenes que ya existan. Crea perfiles, técnicos, informes, cotizaciones, catálogo, notificaciones, trazabilidad, configuración y un bucket privado para archivos. También crea `public.load_data_bundle(text[])`, una función RPC que reúne en una sola respuesta los datos solicitados para cada pantalla. Se ejecuta como el usuario autenticado (`SECURITY INVOKER`), por lo que las políticas RLS existentes siguen aplicándose. Además, agrega las tablas operativas a la publicación `supabase_realtime` para propagar los cambios de inmediato a las sesiones abiertas.
4. Si el proyecto ya estaba configurado, vuelve a ejecutar el `database.sql` completo para habilitar las actualizaciones en tiempo real. Si Supabase informa que no existe la publicación `supabase_realtime`, habilita Realtime para las tablas operativas desde la configuración de Database > Publications. La aplicación además consulta los cambios automáticamente cada 30 segundos y al volver a la pestaña, como respaldo si Realtime no está disponible.
5. La tabla antigua `usuarios` deja de usarse para autenticar, pierde su columna de contraseñas en texto plano y queda sin acceso desde la aplicación. Las cuentas de esa tabla no se convierten automáticamente: vuelve a crearlas en Supabase Auth.

Si aparece `Could not find the function public.load_data_bundle(p_tables) in the schema cache`, ejecuta el `database.sql` actualizado en el SQL Editor del mismo proyecto al que apunta `.env`. El script crea la función con firma `load_data_bundle(text[])`, concede ejecución a `authenticated` y solicita recargar la caché de PostgREST al terminar. Si ya aplicaste el script y el error persiste, ve a **Project Settings > API > Reload schema cache** (o ejecuta `notify pgrst, 'reload schema';` en SQL Editor) y recarga la aplicación. Confirma también que la URL de `.env` corresponde al proyecto donde ejecutaste el SQL.

## 3. Crear la primera cuenta administradora

1. En Supabase, abre **Authentication > Users > Add user**.
2. Crea la cuenta del administrador y confirma el correo en el formulario. El trigger de la migración creará su perfil inicial.
3. En SQL Editor, reemplaza el correo del ejemplo y ejecuta:

   ```sql
   update public.profiles
   set role = 'Administrador'
   where id = (select id from auth.users where email = 'admin@empresa.com');
   ```

4. Inicia sesión en la aplicación con ese correo y la contraseña que configuraste en Supabase Auth.

Para crear personal o clientes, agrega cada cuenta desde **Authentication > Users**. El perfil nuevo comienza con rol `Cliente`. Luego, inicia sesión como administrador y asigna el rol desde **Usuarios y roles** en el menú. Esta pantalla permite relacionar las cuentas de Cliente y Técnico con sus fichas.

Roles disponibles: `Administrador`, `Supervisor`, `Técnico`, `Área administrativa` y `Cliente`. Las políticas RLS limitan el acceso de cliente a sus propios registros; las pantallas y rutas también se filtran por rol.

Solo el rol `Administrador` puede eliminar clientes, vehículos, órdenes, cotizaciones, informes técnicos, técnicos y repuestos. Antes de eliminar, la aplicación pide confirmación; Supabase bloquea el borrado si hay registros dependientes, para conservar el historial. Para habilitar o actualizar estas políticas en un proyecto existente, vuelve a ejecutar el `database.sql` completo desde SQL Editor.

Para dar de alta un Técnico, primero crea su ficha desde el módulo **Técnicos** y luego selecciónala en **Usuarios y roles** al asignar el rol.

El técnico solo verá órdenes que estén asignadas a su ficha. Para asignar una orden, selecciónalo desde Agenda.

## Exportar datos

Los módulos operativos ofrecen exportación a **PDF** y **Excel (.xlsx)** desde las acciones superiores. Se exportan los registros visibles según los filtros activos; en Reportes, el libro Excel incluye una hoja de resumen y otra con las órdenes del período. Los montos se muestran en pesos chilenos y alineados para facilitar la lectura. La opción PDF abre el diálogo de impresión del navegador, donde puedes imprimir o elegir **Guardar como PDF**.

## 4. Ejecutar la aplicación

```bash
npm install
npm run dev
```

Después de cambiar `.env`, detén y vuelve a iniciar Vite para que recargue las variables. Configura también **Authentication > URL Configuration** con la URL local o de producción para que los correos de recuperación puedan volver al sitio correcto.

## Errores comunes de inicio de sesión

- **Correo o contraseña incorrectos:** la cuenta debe existir en **Authentication > Users**; los usuarios de la antigua tabla `usuarios` no se migran automáticamente.
- **El usuario no tiene perfil:** vuelve a ejecutar la migración y confirma que exista una fila en `public.profiles` para el ID de Auth.
- **No se pueden leer o guardar datos:** confirma que ejecutaste `database.sql` en el proyecto al que apuntan las dos variables `.env`, que el perfil esté activo y que tenga el rol correcto.
- **La clave pertenece a otro proyecto:** Project URL y clave pública deben copiarse del mismo proyecto Supabase.

Este proyecto no crea registros de demostración en la base de datos conectada para evitar mezclar datos ficticios con datos reales. Las integraciones de correo, WhatsApp y mapas necesitan configuración de proveedor externo; por ahora la recuperación usa Auth y WhatsApp utiliza el enlace compartido del navegador.
