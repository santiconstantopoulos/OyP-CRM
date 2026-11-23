# OyP Plantillas Esquel · Consultorio

Aplicación privada para registrar consultas, señas, encargos, recepciones, entregas y cobros. Un contacto puede tener varios pedidos. La fecha de los seguimientos corresponde a Argentina.

## Ejecutar el CRM con Node.js

Requiere Node.js 24 o posterior. Usa los módulos HTTP y SQLite incluidos en Node. Se puede iniciar directamente tras descomprimir el proyecto.

1. Abrí una terminal en la carpeta que contiene `package.json`.
2. Copiá `.env.example` como `.env`. En macOS y Linux podés usar `cp .env.example .env`. En PowerShell, `Copy-Item .env.example .env`.
3. Escribí una contraseña propia en `CRM_PASSWORD`. El usuario de acceso es `consultorio`.
4. Creá la base y ejecutá la aplicación.

```sh
npm run db:init
npm start
```

Abrí http://127.0.0.1:3000 e ingresá con la cuenta del consultorio. La base se crea en `data/consultorio.sqlite`. El comando de inicialización se puede repetir. `npm start` también inicializa una base nueva. Los datos se conservan al cerrar el navegador o reiniciar el proceso. Podés configurar otra ubicación mediante `CRM_DB`.

### Acceso desde el celular

La instalación local escucha en la interfaz de loopback. Para usarla desde el celular, servila detrás de un proxy HTTPS que llegue al proceso de Node. Abrí en el teléfono la URL HTTPS de ese servidor. Conservá la carpeta de datos en almacenamiento persistente. Si usás un proxy, conservá el encabezado Host externo para validar el origen de las escrituras.

### Probar con datos ficticios

```sh
npm run demo
```

Abrí http://127.0.0.1:3000. El modo demo crea siete pedidos de ejemplo en memoria. Se reinicia al detenerlo. La instalación con `npm start` usa la base privada en disco. Ejecutá un modo por vez o usá puertos distintos.

Para llevarte el prototipo navegable en un único archivo podés ejecutar `node scripts/prototype.js Prototipo-OyP.html` y abrirlo en el navegador. Sus cambios duran mientras la página sigue abierta.

### Operación diaria

- Desde Inicio, tocá **Nueva consulta**. Con el nombre y un canal de contacto alcanza. Para una recompra, elegí **Contacto existente**.
- Al señar, ingresá producto, precio y seña. El pedido queda en **Por pedir al proveedor**. Confirmá el encargo recién después de hacerlo.
- Cuando llegue el producto, tocá **Marcar como recibido**. Al entregar, verificá el saldo y confirmá. Una seña del 100 % muestra **Ya está pago**.
- Buscá por nombre, WhatsApp o Instagram desde la lupa. La ficha reúne la venta, sus hitos y las demás compras de ese contacto.
- En una consulta podés guardar la próxima acción y su fecha, reprogramarla, quitar la fecha o cerrar sin venta. Inicio muestra pendientes hasta hoy inclusive.
- Guardá el teléfono con código de país y área para que el enlace de WhatsApp llegue al número correcto.

## Verificación

```sh
npm test
```

Las pruebas crean contactos ficticios y bases temporales. Cubren alta mínima y repetida, validaciones sin escritura parcial, $80.000 con seña de $30.000, avance por etapas, lectura sin cobro, doble entrega, saldo cero, señas completas, recompra, vencimiento y reprogramación con medianoche argentina, cierre sin venta y persistencia.

## Datos y concurrencia

Las entidades son `contacto` y `pedido`. Un registro auxiliar `operacion` identifica los reintentos por clave y firma. El servidor guarda el cambio y su comprobante en una transacción. Cada ficha tiene una versión para evitar aplicar cambios sobre información desactualizada. Los importes se almacenan como centavos enteros. El saldo se obtiene de total menos seña menos cobro final. El servidor calcula el cobro al entregar.

Para una copia local consistente, detené el proceso antes de copiar la carpeta de datos completa. El archivo `.env` contiene la contraseña y se administra por separado.

## Publicación en Sites

`npm run build` prepara el Worker en `dist/server/index.js`, su manifiesto y la migración en `dist/drizzle`. La versión alojada usa el mismo código de validación y SQL con la base D1 de Sites. Configurá el binding `DB` y aplicá `drizzle/0000_consultorio.sql` una vez en una base vacía mediante el proceso de migraciones del alojamiento. Mantené el sitio con acceso exclusivo del titular. El Worker verifica la identidad entregada por Sites en cada solicitud. La raíz abre el CRM, `/prototipo` permite practicar con ejemplos, `/guia` abre estas instrucciones y `/proyecto.zip` descarga el código.

El logo y la fotografía de plantillas proceden del sitio de O&P Plantillas Biodinámicas. https://www.plantillasoyp.com/
