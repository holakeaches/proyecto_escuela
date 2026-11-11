//sirve para entornos en tiempo real
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Configuración de la base de datos compras_cons
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',      // Tu usuario de MySQL
  password: '',      // Tu contraseña de MySQL
  database: 'compras_con'
});

db.connect(err => {
  if (err) {
    console.error('❌ Error al conectar a MySQL:', err);
    return;
  }
  console.log('✅ Conectado exitosamente a la base de datos compras_cons');
});

// POST: Login flexible para compras_con
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  // Busca el empleado convirtiendo el texto a minúsculas
  const sql = `
    SELECT e.id_empleado, e.nombre, e.estado, p.nombre AS puesto_nombre
    FROM empleado e
    LEFT JOIN detalle_emp_puesto dep ON e.id_empleado = dep.fk_id_empleado
    LEFT JOIN puesto p ON dep.fk_id_puesto = p.id_puesto
    WHERE LOWER(e.nombre) = LOWER(?) AND e.estado = 1
    LIMIT 1
  `;

  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error('Error en SQL:', err);
      return res.status(500).json({ success: false, message: 'Error interno en la base de datos' });
    }

    if (results.length > 0) {
      const empleado = results[0];
      
      // Valida si la contraseña coincide con 'gerente' o con el nombre de usuario
      if (password.toLowerCase() === 'gerente' || password.toLowerCase() === empleado.nombre.toLowerCase()) {
        return res.json({
          success: true,
          message: 'Acceso concedido',
          empleado: { id: empleado.id_empleado, nombre: empleado.nombre, puesto: empleado.puesto_nombre }
        });
      }
    }

    return res.status(401).json({ success: false, message: 'Usuario o contraseña incorrectos' });
  });
});

// 2. ROUTE: Obtener proveedores
app.get('/api/proveedores', (req, res) => {
  const sql = 'SELECT id_proveedor, nombre FROM proveedor WHERE estado = 1 OR estado IS NULL';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 3. ROUTE: Obtener productos
app.get('/api/productos', (req, res) => {
  const sql = `
    SELECT 
      p.id_producto,
      p.nombre AS producto_nombre,
      p.precio,
      p.prec_min_comp_des,
      p.fecha_inicio_desc,
      p.fecha_fin_des,
      pr.nombre AS proveedor_nombre
    FROM producto p
    LEFT JOIN proveedor pr ON p.fk_id_proveedor = pr.id_proveedor
    ORDER BY p.id_producto DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 4. ROUTE: Insertar producto
app.post('/api/productos', (req, res) => {
  const { nombre, precio, prec_min_comp_des, fecha_inicio_desc, fecha_fin_des, fk_id_proveedor } = req.body;

  const sql = `
    INSERT INTO producto (nombre, precio, prec_min_comp_des, fecha_inicio_desc, fecha_fin_des, fk_id_proveedor) 
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const values = [
    nombre, 
    precio, 
    prec_min_comp_des || null, 
    fecha_inicio_desc || null, 
    fecha_fin_des || null, 
    fk_id_proveedor
  ];

  db.query(sql, values, (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: 'Producto insertado con éxito', id: result.insertId });
  });
});

// Iniciar servidor
app.listen(3000, () => {
  console.log('🚀 Servidor backend ejecutándose en http://localhost:3000');
});

// ==========================================
// RUTAS PARA INGENIERO DE SUELO Y PARCELAS
// ==========================================

// GET: Obtener todas las parcelas con sus recomendaciones
app.get('/api/parcelas', (req, res) => {
  const sql = `
    SELECT 
      p.id_parcela,
      p.ubicacion,
      p.superficie,
      p.cultivo,
      p.tipo_suelo,
      p.fecha_inicio,
      p.estado,
      p.fk_id_dueño_parcela,
      i.ing_suelo AS id_recomendacion,
      i.recomendacion,
      i.fecha_fin AS fecha_estudio
    FROM parcela p
    LEFT JOIN ingeniero_suelo i ON p.fk_id_producto = i.fk_id_producto
    ORDER BY p.id_parcela DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// POST: Registrar nueva parcela y su análisis de suelo
app.post('/api/parcelas', (req, res) => {
  const { ubicacion, superficie, cultivo, tipo_suelo, fecha_estudio, recomendacion } = req.body;

  const sqlParcela = `
    INSERT INTO parcela (ubicacion, superficie, cultivo, tipo_suelo, fecha_inicio, estado) 
    VALUES (?, ?, ?, ?, ?, 1)
  `;

  db.query(sqlParcela, [ubicacion, superficie, cultivo, tipo_suelo, fecha_estudio], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const idParcela = result.insertId;

    // Si incluyó una recomendación, la guardamos en ingeniero_suelo
    if (recomendacion) {
      const sqlIng = `
        INSERT INTO ingeniero_suelo (recomendacion, fecha_inicio, fecha_fin) 
        VALUES (?, ?, ?)
      `;
      db.query(sqlIng, [recomendacion, fecha_estudio, fecha_estudio], (errIng) => {
        if (errIng) console.error("Error al guardar recomendación:", errIng);
      });
    }

    res.status(201).json({ message: 'Parcela registrada exitosamente', id: idParcela });
  });
});

// PUT: Actualizar parcela y sus requerimientos de suelo
app.put('/api/parcelas/:id', (req, res) => {
  const idParcela = req.params.id;
  const { ubicacion, superficie, cultivo, tipo_suelo, fecha_estudio, recomendacion } = req.body;

  const sqlUpdate = `
    UPDATE parcela 
    SET ubicacion = ?, superficie = ?, cultivo = ?, tipo_suelo = ?, fecha_inicio = ? 
    WHERE id_parcela = ?
  `;

  db.query(sqlUpdate, [ubicacion, superficie, cultivo, tipo_suelo, fecha_estudio, idParcela], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Parcela actualizada correctamente' });
  });
});

// DELETE: Eliminar una parcela
app.delete('/api/parcelas/:id', (req, res) => {
  const idParcela = req.params.id;

  const sqlDelete = 'DELETE FROM parcela WHERE id_parcela = ?';
  db.query(sqlDelete, [idParcela], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Parcela eliminada exitosamente' });
  });
});