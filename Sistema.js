export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Headers CORS para todas las respuestas
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cache-Control, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    };

    // Manejar preflight requests (OPTIONS)
    if (method === 'OPTIONS') {
      return new Response(null, { 
        status: 200,
        headers: corsHeaders 
      });
    }

    try {
      console.log(`🔍 Petición recibida: ${method} ${path}`);

      // ===== HEALTH CHECK =====
      if (path === '/api/health') {
        console.log('✅ Health check OK');
        return new Response(JSON.stringify({
          success: true,
          status: 'ok',
          message: 'Sistema Saeta Worker funcionando',
          timestamp: new Date().toISOString(),
          version: '2.0'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // ===== REGISTRAR USUARIO =====
      if (path === '/api/usuarios/registrar' && method === 'POST') {
        console.log('👤 Registrando nuevo usuario...');
        
        try {
          const userData = await request.json();
          const { ci, nombre, email, telefono } = userData;
          
          if (!ci || !nombre) {
            return new Response(JSON.stringify({
              success: false,
              message: 'C.I. y nombre son obligatorios'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Verificar si el usuario ya existe
          const usuarioExistente = await env.SAETA_PEDIDOS.get(`usuario_${ci}`);
          if (usuarioExistente) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Ya existe un usuario con este C.I.'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Crear nuevo usuario
          const usuario = {
            ci: ci,
            nombre: nombre,
            email: email || '',
            telefono: telefono || '',
            fecha_registro: new Date().toISOString(),
            estado: 'activo'
          };

          await env.SAETA_PEDIDOS.put(`usuario_${ci}`, JSON.stringify(usuario));
          
          console.log(`✅ Usuario ${ci} registrado exitosamente`);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Usuario registrado exitosamente',
            usuario: usuario
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error registrando usuario:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al registrar usuario',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== LOGIN USUARIO =====
      if (path === '/api/usuarios/login' && method === 'POST') {
        console.log('🔐 Login de usuario...');
        
        try {
          const loginData = await request.json();
          const { ci, nombre } = loginData;
          
          if (!ci || !nombre) {
            return new Response(JSON.stringify({
              success: false,
              message: 'C.I. y nombre son obligatorios'
            }), {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          // Buscar usuario
          const usuarioData = await env.SAETA_PEDIDOS.get(`usuario_${ci}`);
          if (!usuarioData) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Usuario no encontrado. ¿Necesitas registrarte?'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const usuario = JSON.parse(usuarioData);
          
          // Verificar contraseña (nombre)
          if (usuario.nombre.toLowerCase() !== nombre.toLowerCase()) {
            return new Response(JSON.stringify({
              success: false,
              message: 'Credenciales incorrectas'
            }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          console.log(`✅ Login exitoso para usuario ${ci}`);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Login exitoso',
            usuario: usuario
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error en login:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error en login',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== OBTENER TODOS LOS USUARIOS =====
      if (path === '/api/usuarios' && method === 'GET') {
        console.log('👥 Obteniendo todos los usuarios...');
        
        try {
          // Listar todas las claves del KV
          const list = await env.SAETA_PEDIDOS.list();
          const usuarios = [];
          
          if (!list || !list.keys) {
            console.log('⚠️ KV list está vacío o no disponible');
          } else {
            console.log(`🔍 Revisando ${list.keys.length} claves en KV`);
            
            // Procesar cada clave que sea un usuario
            for (const key of list.keys) {
              if (key.name.startsWith('usuario_')) {
                try {
                  const data = await env.SAETA_PEDIDOS.get(key.name);
                  if (data) {
                    const usuario = JSON.parse(data);
                    usuarios.push(usuario);
                  }
                } catch (e) {
                  console.error(`❌ Error procesando ${key.name}:`, e);
                }
              }
            }
          }
          
          // Ordenar por fecha de registro
          usuarios.sort((a, b) => {
            const fechaA = new Date(a.fecha_registro || 0);
            const fechaB = new Date(b.fecha_registro || 0);
            return fechaB - fechaA;
          });
          
          console.log(`📤 Enviando ${usuarios.length} usuarios`);
          
          return new Response(JSON.stringify({
            success: true,
            data: usuarios,
            total: usuarios.length,
            message: usuarios.length === 0 ? 'No hay usuarios registrados aún' : `${usuarios.length} usuarios encontrados`
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error obteniendo usuarios:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al obtener usuarios',
            details: error.message,
            data: []
          }), {
            status: 200, // Cambiar a 200 para evitar 500 en casos de error menor
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== OBTENER PEDIDOS DE USUARIO =====
      if (path.match(/^\/api\/usuarios\/(.+)\/pedidos$/) && method === 'GET') {
        const matches = path.match(/^\/api\/usuarios\/(.+)\/pedidos$/);
        const ci = matches[1];
        
        console.log(`📋 Obteniendo pedidos del usuario ${ci}...`);
        
        try {
          // Listar todas las claves del KV
          const list = await env.SAETA_PEDIDOS.list();
          const pedidosUsuario = [];
          
          // Procesar cada clave que sea un pedido activo
          for (const key of list.keys) {
            if (key.name.startsWith('pedido_') && !key.name.includes('_eliminado_')) {
              try {
                const data = await env.SAETA_PEDIDOS.get(key.name);
                if (data) {
                  const pedido = JSON.parse(data);
                  
                  // Verificar si el pedido pertenece al usuario
                  if (pedido.ci === ci || pedido.usuario_ci === ci) {
                    // GARANTIZAR que comentarios existe
                    if (!pedido.comentarios) {
                      pedido.comentarios = '';
                    }
                    
                    // Mapear comentarios a observaciones para compatibilidad con frontend
                    pedido.observaciones = pedido.comentarios;
                    
                    pedidosUsuario.push(pedido);
                  }
                }
              } catch (e) {
                console.error(`❌ Error procesando ${key.name}:`, e);
              }
            }
          }
          
          // Ordenar por fecha
          pedidosUsuario.sort((a, b) => {
            const fechaA = new Date(a.fecha_creacion || a.fecha_pedido || 0);
            const fechaB = new Date(b.fecha_creacion || b.fecha_pedido || 0);
            return fechaB - fechaA;
          });
          
          console.log(`📤 Enviando ${pedidosUsuario.length} pedidos del usuario ${ci}`);
          
          return new Response(JSON.stringify({
            success: true,
            data: pedidosUsuario,
            total: pedidosUsuario.length
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error obteniendo pedidos del usuario:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al obtener pedidos del usuario',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== OBTENER PEDIDO ESPECÍFICO =====
      if (path.match(/^\/api\/pedidos\/(.+)$/) && method === 'GET') {
        const matches = path.match(/^\/api\/pedidos\/(.+)$/);
        const idPedido = matches[1];
        
        console.log(`📄 Obteniendo pedido ${idPedido}...`);
        
        try {
          const data = await env.SAETA_PEDIDOS.get(`pedido_${idPedido}`);
          if (!data) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const pedido = JSON.parse(data);
          
          // GARANTIZAR que comentarios existe
          if (!pedido.comentarios) {
            pedido.comentarios = '';
          }
          
          // Mapear comentarios a observaciones para compatibilidad con frontend
          pedido.observaciones = pedido.comentarios;
          
          return new Response(JSON.stringify({
            success: true,
            data: pedido
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error obteniendo pedido:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al obtener pedido',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== ACTUALIZAR PEDIDO =====
      if (path.match(/^\/api\/pedidos\/(.+)\/actualizar$/) && method === 'PUT') {
        const matches = path.match(/^\/api\/pedidos\/(.+)\/actualizar$/);
        const idPedido = matches[1];
        
        console.log(`✏️ Actualizando pedido ${idPedido}...`);
        
        try {
          const data = await request.json();
          
          // Obtener pedido existente
          const pedidoExistente = await env.SAETA_PEDIDOS.get(`pedido_${idPedido}`);
          if (!pedidoExistente) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const pedidoAnterior = JSON.parse(pedidoExistente);
          
          // Crear pedido actualizado
          const pedidoActualizado = {
            ...pedidoAnterior,
            ...data,
            // Mapear observaciones a comentarios
            comentarios: data.observaciones || data.comentarios || pedidoAnterior.comentarios,
            modalidad: data.modalidad || pedidoAnterior.modalidad,
            id_pedido: idPedido,
            fecha_actualizacion: new Date().toISOString(),
            historial_modificaciones: pedidoAnterior.historial_modificaciones || []
          };

          // Agregar registro de modificación
          pedidoActualizado.historial_modificaciones.push({
            fecha: new Date().toISOString(),
            cambios: 'Pedido actualizado por el usuario',
            datos_anteriores: {
              productos: pedidoAnterior.productos,
              observaciones: pedidoAnterior.observaciones,
              fecha_entrega: pedidoAnterior.fecha_entrega
            }
          });

          // GARANTIZAR que comentarios existe
          if (!pedidoActualizado.comentarios) {
            pedidoActualizado.comentarios = '';
          }
          
          console.log(`💾 Actualizando ${idPedido}...`);
          
          // Guardar en KV
          await env.SAETA_PEDIDOS.put(`pedido_${idPedido}`, JSON.stringify(pedidoActualizado));
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Pedido actualizado exitosamente',
            data: pedidoActualizado
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error actualizando pedido:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al actualizar pedido',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== OBTENER TODOS LOS PEDIDOS (OPTIMIZADO) =====
      if (path === '/api/pedidos' && method === 'GET') {
        console.log('📋 Obteniendo pedidos (optimizado)...');
        
        try {
          const startTime = Date.now();
          
          // Verificar que el KV esté disponible
          if (!env.SAETA_PEDIDOS) {
            console.error('❌ KV SAETA_PEDIDOS no está configurado');
            return new Response(JSON.stringify({
              success: false,
              error: 'Base de datos no disponible',
              data: []
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          // Listar todas las claves del KV con límite
          const list = await env.SAETA_PEDIDOS.list({ limit: 1000 });
          
          if (!list || !list.keys) {
            return new Response(JSON.stringify({
              success: true,
              data: [],
              total: 0,
              message: 'No hay pedidos aún'
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          console.log(`📊 Total claves: ${list.keys.length}`);
          
          // Filtrar solo claves de pedidos activos (más rápido)
          const pedidoKeys = list.keys.filter(key => 
            key.name.startsWith('pedido_') && 
            !key.name.includes('_eliminado_') &&
            !key.name.startsWith('pedido-175') // Excluir pedidos muy antiguos si es necesario
          );
          
          console.log(`🔍 Pedidos activos a procesar: ${pedidoKeys.length}`);
          
          // Procesar pedidos en lotes para optimizar
          const batchSize = 50;
          const pedidos = [];
          
          for (let i = 0; i < pedidoKeys.length; i += batchSize) {
            const batch = pedidoKeys.slice(i, i + batchSize);
            
            // Procesar lote en paralelo
            const batchPromises = batch.map(async (key) => {
              try {
                const data = await env.SAETA_PEDIDOS.get(key.name);
                if (data) {
                  const pedido = JSON.parse(data);
                  
                  // Campos completos incluyendo planilla y factura para el admin
                  return {
                    id_pedido: pedido.id_pedido || pedido.id,
                    nombre_completo: pedido.nombre_completo || '',
                    ci: pedido.ci || pedido.usuario_ci || '',
                    telefono: pedido.telefono || '',
                    email: pedido.email || '',
                    club: pedido.club || '',
                    modalidad: pedido.modalidad || '',
                    fecha_creacion: pedido.fecha_creacion || pedido.fecha_pedido,
                    fecha_pedido: pedido.fecha_pedido || pedido.fecha_creacion,
                    fecha_entrega: pedido.fecha_entrega || '',
                    direccion: pedido.direccion || '',
                    estado: pedido.estado || 'activo',
                    completado: pedido.completado || false,
                    comentarios: pedido.comentarios || pedido.observaciones || '',
                    observaciones: pedido.comentarios || pedido.observaciones || '',
                    imagen_referencia: pedido.imagen_referencia || '',
                    productos_seleccionados: pedido.productos_seleccionados,
                    filas: pedido.filas,
                    cantidades: pedido.cantidades,
                    planilla_completa: pedido.planilla_completa || [],
                    total_general: pedido.total_general || 0,
                    factura: pedido.factura || null,
                    timestamp: pedido.timestamp || 0
                  };
                }
                return null;
              } catch (e) {
                console.error(`❌ Error procesando ${key.name}:`, e);
                return null;
              }
            });
            
            const batchResults = await Promise.all(batchPromises);
            const validResults = batchResults.filter(p => p !== null);
            pedidos.push(...validResults);
            
            console.log(`✅ Lote ${Math.floor(i/batchSize) + 1} procesado: ${validResults.length} pedidos`);
          }
          
          // Ordenar por fecha (más rápido con timestamp)
          pedidos.sort((a, b) => {
            const timestampA = a.timestamp || new Date(a.fecha_creacion || a.fecha_pedido || 0).getTime();
            const timestampB = b.timestamp || new Date(b.fecha_creacion || b.fecha_pedido || 0).getTime();
            return timestampB - timestampA;
          });
          
          const endTime = Date.now();
          const processingTime = endTime - startTime;
          
          console.log(`� Enviando ${pedidos.length} pedidos en ${processingTime}ms`);
          
          return new Response(JSON.stringify({
            success: true,
            data: pedidos,
            total: pedidos.length,
            processing_time_ms: processingTime,
            message: `${pedidos.length} pedidos cargados en ${processingTime}ms`
          }), {
            status: 200,
            headers: { 
              ...corsHeaders, 
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=30' // Cache por 30 segundos
            }
          });
          
        } catch (error) {
          console.error('❌ Error en GET /api/pedidos:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al obtener pedidos',
            details: error.message,
            data: []
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== CREAR NUEVO PEDIDO =====
      if (path === '/api/pedidos' && method === 'POST') {
        console.log('➕ Creando nuevo pedido...');
        
        try {
          const data = await request.json();
          
          console.log('📥 Datos recibidos:', JSON.stringify(data, null, 2));
          console.log('💬 Comentarios recibidos:', `"${data.comentarios}"`);
          
          // Generar ID único
          const hoy = new Date().toISOString().split('T')[0].replace(/-/g, '');
          
          // Obtener TODAS las claves (activas y eliminadas) para encontrar el último número
          const list = await env.SAETA_PEDIDOS.list();
          
          let maxNum = 0;
          for (const key of list.keys) {
            // Buscar patrón: pedido_SAETA-YYYYMMDD-NNNN o pedido_SAETA-YYYYMMDD-NNNN_eliminado_*
            const match = key.name.match(/pedido_SAETA-(\d{8})-(\d{4})/);
            if (match) {
              const fecha = match[1];
              const num = parseInt(match[2], 10);
              
              // Solo considerar pedidos del día actual para resetear numeración diaria
              if (fecha === hoy && num > maxNum) {
                maxNum = num;
              }
            }
          }
          
          const num = maxNum + 1;
          const id = `SAETA-${hoy}-${num.toString().padStart(4, '0')}`;
          
          console.log(`🔢 Último número usado hoy: ${maxNum}, Nuevo ID: ${id}`);
          
          // Crear pedido
          const pedido = {
            id_pedido: id,
            fecha_creacion: new Date().toISOString(),
            fecha_procesamiento: new Date().toISOString().split('T')[0],
            fecha_pedido: data.fecha_pedido || new Date().toISOString(),
            timestamp: Math.floor(Date.now() / 1000),
            nombre_completo: data.nombre_completo || '',
            ci: data.ci || '',
            telefono: data.telefono || '',
            club: data.club || '',
            modalidad: data.modalidad || '', // NUEVO: Campo modalidad
            fecha_entrega: data.fecha_entrega || '',
            direccion: data.direccion || '',
            comentarios: data.observaciones || data.comentarios || '', // Mapear observaciones a comentarios
            imagen_referencia: data.imagen_referencia || null, // NUEVO: Campo para imagen
            productos_seleccionados: JSON.stringify(data.productos_seleccionados || []),
            filas: typeof data.filas === 'string' ? data.filas : JSON.stringify(data.filas || []),
            cantidades: typeof data.cantidades === 'string' ? data.cantidades : JSON.stringify(data.cantidades || { remeras: 0, shorts: 0, medias: 0 }),
            planilla_completa: data.planilla_completa || [],
            archivo_local: null,
            estado: 'activo',
            origen: 'web'
          };
          
          console.log(`💾 Guardando ${id} con comentarios: "${pedido.comentarios}"`);
          
          // Guardar en KV
          await env.SAETA_PEDIDOS.put(`pedido_${id}`, JSON.stringify(pedido));
          // Guardar en D1 (Cloudflare SQL)
          if (env.DB && env.DB.prepare) {
            try {
              const insertSQL = 'INSERT INTO pedidos (id_pedido, fecha_procesamiento, fecha_pedido, nombre_completo, ci, telefono, club, modalidad, fecha_entrega, direccion, comentarios, imagen_referencia, productos_seleccionados, filas, cantidades, archivo_local, estado, origen, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
              await env.DB.prepare(insertSQL).bind(
                pedido.id_pedido,
                pedido.fecha_procesamiento,
                pedido.fecha_pedido,
                pedido.nombre_completo,
                pedido.ci,
                pedido.telefono,
                pedido.club,
                pedido.modalidad, // NUEVO: Campo modalidad
                pedido.fecha_entrega,
                pedido.direccion,
                pedido.comentarios,
                pedido.imagen_referencia, // NUEVO: Campo imagen
                pedido.productos_seleccionados,
                pedido.filas,
                pedido.cantidades,
                pedido.archivo_local,
                pedido.estado,
                pedido.origen,
                pedido.timestamp
              ).run();
              console.log('✅ Pedido ' + id + ' insertado en D1 correctamente');
            } catch (e) {
              console.error('❌ Error al insertar en D1:', e);
            }
          } else {
            console.warn('⚠️ env.DB no está configurado. No se guardó en D1.');
          }
          console.log(`✅ Pedido ${id} guardado exitosamente`);
          return new Response(JSON.stringify({
            success: true,
            message: 'Pedido creado exitosamente',
            pedido: pedido
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('❌ Error en POST /api/pedidos:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al crear pedido',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== ACTUALIZAR PEDIDO =====
      if (path.match(/^\/api\/pedidos\/(.+)$/) && method === 'PUT') {
        const matches = path.match(/^\/api\/pedidos\/(.+)$/);
        const idPedido = matches[1];
        
        console.log(`🔄 Actualizando pedido ${idPedido}...`);
        
        try {
          // Obtener el pedido existente
          const existingData = await env.SAETA_PEDIDOS.get(`pedido_${idPedido}`);
          if (!existingData) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const existingPedido = JSON.parse(existingData);
          const data = await request.json();
          
          // Actualizar el pedido manteniendo la estructura original
          const updatedPedido = {
            ...existingPedido, // Mantener todos los campos existentes
            // Sobrescribir solo los campos que se están actualizando
            nombre_completo: data.nombre_completo || existingPedido.nombre_completo,
            ci: data.ci || existingPedido.ci,
            telefono: data.telefono || existingPedido.telefono,
            club: data.club || existingPedido.club,
            modalidad: data.modalidad || existingPedido.modalidad, // NUEVO: Campo modalidad
            fecha_entrega: data.fecha_entrega || existingPedido.fecha_entrega,
            direccion: data.direccion || existingPedido.direccion,
            comentarios: data.observaciones !== undefined ? data.observaciones : (data.comentarios !== undefined ? data.comentarios : existingPedido.comentarios), // Mapear observaciones a comentarios
            imagen_referencia: data.imagen_referencia !== undefined ? data.imagen_referencia : existingPedido.imagen_referencia,
            productos_seleccionados: data.productos_seleccionados ? JSON.stringify(data.productos_seleccionados) : existingPedido.productos_seleccionados,
            filas: data.filas ? (typeof data.filas === 'string' ? data.filas : JSON.stringify(data.filas)) : existingPedido.filas,
            cantidades: data.cantidades ? (typeof data.cantidades === 'string' ? data.cantidades : JSON.stringify(data.cantidades)) : existingPedido.cantidades,
            planilla_completa: data.planilla_completa || existingPedido.planilla_completa,
            completado: data.completado !== undefined ? data.completado : existingPedido.completado,
            // Mantener o actualizar factura si viene en el request
            factura: data.factura !== undefined ? data.factura : existingPedido.factura,
            fecha_modificacion: new Date().toISOString() // Agregar timestamp de modificación
          };

          console.log(`💾 Actualizando ${idPedido} con comentarios: "${updatedPedido.comentarios}"`);
          
          // Guardar en KV
          await env.SAETA_PEDIDOS.put(`pedido_${idPedido}`, JSON.stringify(updatedPedido));
          
          // Actualizar en D1 (Cloudflare SQL)
          if (env.DB && env.DB.prepare) {
            try {
              const updateSQL = `UPDATE pedidos SET 
                nombre_completo = ?, 
                ci = ?, 
                telefono = ?, 
                club = ?, 
                fecha_entrega = ?, 
                direccion = ?, 
                comentarios = ?, 
                imagen_referencia = ?, 
                productos_seleccionados = ?, 
                filas = ?, 
                cantidades = ?,
                completado = ?
                WHERE id_pedido = ?`;
              
              await env.DB.prepare(updateSQL).bind(
                updatedPedido.nombre_completo,
                updatedPedido.ci,
                updatedPedido.telefono,
                updatedPedido.club,
                updatedPedido.fecha_entrega,
                updatedPedido.direccion,
                updatedPedido.comentarios,
                updatedPedido.imagen_referencia,
                updatedPedido.productos_seleccionados,
                updatedPedido.filas,
                updatedPedido.cantidades,
                updatedPedido.completado ? 1 : 0, // Convertir boolean a integer para SQL
                idPedido
              ).run();
              console.log('✅ Pedido ' + idPedido + ' actualizado en D1 correctamente');
            } catch (e) {
              console.error('❌ Error al actualizar en D1:', e);
            }
          }

          console.log(`✅ Pedido ${idPedido} actualizado exitosamente`);
          return new Response(JSON.stringify({
            success: true,
            message: 'Pedido actualizado exitosamente',
            pedido: updatedPedido
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('❌ Error en PUT /api/pedidos:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al actualizar pedido',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== GUARDAR COMENTARIOS DE ADMIN =====
      if (path.match(/^\/api\/pedidos\/(.+)\/admin-comments$/) && method === 'POST') {
        const matches = path.match(/^\/api\/pedidos\/(.+)\/admin-comments$/);
        const idPedido = matches[1];

        console.log(`📝 Guardando comentarios de admin para ${idPedido}...`);

        try {
          const body = await request.json();
          const adminComentarios = (body && typeof body.admin_comentarios === 'string')
            ? body.admin_comentarios.trim()
            : '';

          const pedidoData = await env.SAETA_PEDIDOS.get(`pedido_${idPedido}`);
          if (!pedidoData) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }

          const pedido = JSON.parse(pedidoData);
          pedido.admin_comentarios = adminComentarios;
          pedido.fecha_admin_comentarios = new Date().toISOString();

          await env.SAETA_PEDIDOS.put(`pedido_${idPedido}`, JSON.stringify(pedido));

          if (env.DB && env.DB.prepare) {
            try {
              await env.DB.prepare('UPDATE pedidos SET admin_comentarios = ? WHERE id_pedido = ?')
                .bind(adminComentarios, idPedido)
                .run();
            } catch (e) {
              console.warn('⚠️ No se pudo guardar admin_comentarios en D1:', e);
            }
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Comentarios de admin guardados',
            data: {
              id_pedido: idPedido,
              admin_comentarios: adminComentarios
            }
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (error) {
          console.error('❌ Error guardando comentarios de admin:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al guardar comentarios de admin',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== MOVER A PAPELERA =====
      if (path.match(/^\/api\/pedidos\/(.+)\/papelera$/) && method === 'POST') {
        const matches = path.match(/^\/api\/pedidos\/(.+)\/papelera$/);
        const idPedido = matches[1];
        
        console.log(`🗑️ Moviendo ${idPedido} a papelera...`);
        
        try {
          // Obtener pedido
          const data = await env.SAETA_PEDIDOS.get(`pedido_${idPedido}`);
          if (!data) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const pedido = JSON.parse(data);
          pedido.fecha_eliminacion = new Date().toISOString();
          pedido.eliminado = true;
          
          // GARANTIZAR comentarios
          if (!pedido.comentarios) {
            pedido.comentarios = '';
          }
          
          console.log(`💬 Manteniendo comentarios: "${pedido.comentarios}"`);
          
          // Mover a papelera
          await env.SAETA_PEDIDOS.put(`pedido_${idPedido}_eliminado_${Date.now()}`, JSON.stringify(pedido));
          await env.SAETA_PEDIDOS.delete(`pedido_${idPedido}`);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Pedido movido a papelera'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('❌ Error moviendo a papelera:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al mover a papelera',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== OBTENER PAPELERA =====
      if (path === '/api/papelera' && method === 'GET') {
        console.log('🗂️ Obteniendo papelera...');
        
        try {
          const list = await env.SAETA_PEDIDOS.list();
          const papelera = [];
          
          for (const key of list.keys) {
            if (key.name.includes('_eliminado_')) {
              try {
                const data = await env.SAETA_PEDIDOS.get(key.name);
                if (data) {
                  const pedido = JSON.parse(data);
                  
                  // GARANTIZAR comentarios
                  if (!pedido.comentarios) {
                    pedido.comentarios = '';
                  }
                  
                  papelera.push(pedido);
                }
              } catch (e) {
                console.error(`❌ Error en papelera ${key.name}:`, e);
              }
            }
          }
          
          // Ordenar por fecha eliminación
          papelera.sort((a, b) => {
            const fechaA = new Date(a.fecha_eliminacion || 0);
            const fechaB = new Date(b.fecha_eliminacion || 0);
            return fechaB - fechaA;
          });
          
          return new Response(JSON.stringify({
            success: true,
            data: papelera,
            total: papelera.length
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('❌ Error obteniendo papelera:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al obtener papelera',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== RESTAURAR DE PAPELERA =====
      if (path.match(/^\/api\/pedidos\/(.+)\/restaurar$/) && method === 'POST') {
        const matches = path.match(/^\/api\/pedidos\/(.+)\/restaurar$/);
        const idPedido = matches[1];
        
        console.log(`♻️ Restaurando ${idPedido}...`);
        
        try {
          // Buscar en papelera
          const list = await env.SAETA_PEDIDOS.list();
          let pedidoData = null;
          let claveOriginal = null;
          
          for (const key of list.keys) {
            if (key.name.includes('_eliminado_') && key.name.includes(idPedido)) {
              pedidoData = await env.SAETA_PEDIDOS.get(key.name);
              if (pedidoData) {
                claveOriginal = key.name;
                break;
              }
            }
          }
          
          if (!pedidoData) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado en papelera'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          const pedido = JSON.parse(pedidoData);
          delete pedido.fecha_eliminacion;
          delete pedido.eliminado;
          
          // GARANTIZAR comentarios
          if (!pedido.comentarios) {
            pedido.comentarios = '';
          }
          
          // Restaurar
          await env.SAETA_PEDIDOS.put(`pedido_${idPedido}`, JSON.stringify(pedido));
          await env.SAETA_PEDIDOS.delete(claveOriginal);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Pedido restaurado exitosamente'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('❌ Error restaurando:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al restaurar pedido',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== ELIMINAR PERMANENTEMENTE =====
      if (path.match(/^\/api\/pedidos\/(.+)\/eliminar-permanente$/) && method === 'DELETE') {
        const matches = path.match(/^\/api\/pedidos\/(.+)\/eliminar-permanente$/);
        const idPedido = matches[1];
        
        console.log(`🔥 Eliminando permanentemente ${idPedido}...`);
        
        try {
          // Buscar en papelera
          const list = await env.SAETA_PEDIDOS.list();
          let claveAEliminar = null;
          
          for (const key of list.keys) {
            if (key.name.includes('_eliminado_') && key.name.includes(idPedido)) {
              claveAEliminar = key.name;
              break;
            }
          }
          
          if (!claveAEliminar) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Pedido no encontrado en papelera'
            }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          await env.SAETA_PEDIDOS.delete(claveAEliminar);
          
          return new Response(JSON.stringify({
            success: true,
            message: 'Pedido eliminado permanentemente'
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
          
        } catch (error) {
          console.error('❌ Error eliminando permanentemente:', error);
          return new Response(JSON.stringify({
            success: false,
            error: 'Error al eliminar permanentemente',
            details: error.message
          }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // ===== WEBHOOK WHATSAPP (CLOUD API) =====
      if (path === '/api/whatsapp-webhook') {
        const VERIFY_TOKEN = env.WHATSAPP_VERIFY_TOKEN || 'SAETA_WHATSAPP_TOKEN_123';

        // Verificación inicial del webhook (GET)
        if (method === 'GET') {
          const mode = url.searchParams.get('hub.mode');
          const token = url.searchParams.get('hub.verify_token');
          const challenge = url.searchParams.get('hub.challenge');

          console.log('📡 Verificación webhook WhatsApp:', { mode, token, challenge });

          if (mode === 'subscribe' && token === VERIFY_TOKEN && challenge) {
            return new Response(challenge, {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
            });
          }

          return new Response('Forbidden', {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
          });
        }

        // Recepción de mensajes / eventos (POST)
        if (method === 'POST') {
          try {
            const body = await request.json();
            console.log('📩 Webhook WhatsApp recibido:', JSON.stringify(body, null, 2));

            // TODO: aquí más adelante vamos a
            // 1) guardar el mensaje en D1 / KV
            // 2) conectar con tu lógica de chatbot

            return new Response(JSON.stringify({ success: true }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          } catch (error) {
            console.error('❌ Error procesando webhook WhatsApp:', error);
            return new Response(JSON.stringify({
              success: false,
              error: 'Error procesando webhook WhatsApp',
              details: error.message
            }), {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        }
      }

      // ===== RUTA NO ENCONTRADA =====
      console.log(`❌ Ruta no encontrada: ${method} ${path}`);
      return new Response(JSON.stringify({
        success: false,
        error: `Ruta no encontrada: ${method} ${path}`,
        available_routes: [
          'GET /api/health',
          'GET /api/pedidos',
          'POST /api/pedidos',
          'GET /api/pedidos/{id}',
          'PUT /api/pedidos/{id}/actualizar',
          'POST /api/usuarios/registrar',
          'POST /api/usuarios/login',
          'GET /api/usuarios',
          'GET /api/usuarios/{ci}/pedidos',
          'GET /api/papelera',
          'POST /api/pedidos/{id}/admin-comments',
          'POST /api/pedidos/{id}/papelera',
          'POST /api/pedidos/{id}/restaurar',
          'DELETE /api/pedidos/{id}/eliminar-permanente'
        ]
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('💥 Error general:', error);
      return new Response(JSON.stringify({
        success: false,
        error: 'Error interno del servidor',
        details: error.message,
        stack: error.stack
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
