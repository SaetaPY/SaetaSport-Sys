-- Esquema minimo para la tabla usada por Sistema.js
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_pedido TEXT UNIQUE NOT NULL,
  fecha_procesamiento TEXT,
  fecha_pedido TEXT,
  nombre_completo TEXT,
  ci TEXT,
  telefono TEXT,
  club TEXT,
  modalidad TEXT,
  fecha_entrega TEXT,
  direccion TEXT,
  comentarios TEXT,
  admin_comentarios TEXT,
  imagen_referencia TEXT,
  productos_seleccionados TEXT,
  filas TEXT,
  cantidades TEXT,
  archivo_local TEXT,
  estado TEXT,
  origen TEXT,
  timestamp INTEGER,
  completado INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pedidos_id_pedido ON pedidos(id_pedido);
CREATE INDEX IF NOT EXISTS idx_pedidos_ci ON pedidos(ci);
CREATE INDEX IF NOT EXISTS idx_pedidos_timestamp ON pedidos(timestamp);
