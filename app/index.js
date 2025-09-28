require('dotenv').config();
const express = require('express');
const redis = require('redis');
const cors = require("cors");

const PORT = process.env.PORT || 3000;
const REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const TMDB_API_KEY = process.env.TMDB_API_KEY || ''; // Pon tu API key aquí si usas TMDb
const BASE_URL = 'https://api.themoviedb.org/3';

const app = express();
app.use(cors());
const redisClient = redis.createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`
});

async function main() {
  try {
    await redisClient.connect();
    console.log('Conectado a Redis en', `${REDIS_HOST}:${REDIS_PORT}`);
  } catch (err) {
    console.warn('No se pudo conectar a Redis (continuamos sin caché):', err.message);
  }

  // Endpoint que siempre consulta TMDb (NO usa Redis ni guarda en caché)
  app.get('/peliculas/top-nocache', async (req, res) => {
    try {
      console.log('Consultando API externa (NO CACHE)...');
      const resp = await fetch(`${BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=es-ES`);
      if (!resp.ok) return res.status(resp.status).send('Error en API externa (TMDb)');
      const data = await resp.json();
      return res.json(data);
    } catch (err) {
      console.error('Error en /peliculas/top-nocache:', err.message);
      return res.status(500).send('Error interno');
    }
  });

  app.get('/peliculas/top', async (req, res) => {
    const cacheKey = 'top_movies';

    // 1) intentar desde caché
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log('Respondiendo desde caché');
        return res.json(JSON.parse(cached));
      }
    } catch (err) {
      console.warn('Error al leer caché:', err.message);
      // seguimos a la API
    }

    // 2) llamar a la API externa (TMDb)
    try {
      console.log('Consultando API externa (TMDb)...');
      const resp = await fetch(`${BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}&language=es-ES`);
      if (!resp.ok) return res.status(resp.status).send('Error en API externa');
      const data = await resp.json();

      // 3) guardar en caché (TTL 10 min = 600s)
      try {
        await redisClient.setEx(cacheKey, 600, JSON.stringify(data));
      } catch (e) {
        console.warn(' No se pudo guardar en caché:', e.message);
      }

      return res.json(data);
    } catch (err) {
      console.error(err);
      return res.status(500).send('Error interno');
    }
  });

  app.get('/peliculas/por-genero/:idGenero', async (req, res) => {
  const { idGenero } = req.params;
  const cacheKey = `peliculas_genero_${idGenero}`;

  try {
    // 1) intentar desde caché
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      console.log(`Respondiendo desde caché (género ${idGenero})`);
      return res.json(JSON.parse(cached));
    }

    // 2) llamar a la API externa
    const resp = await fetch(`${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_genres=${idGenero}&language=es-ES`);
    if (!resp.ok) return res.status(resp.status).send('Error en API externa');
    const data = await resp.json();

    // 3) guardar en caché por 10 minutos
    await redisClient.setEx(cacheKey, 600, JSON.stringify(data));

    return res.json(data);
  } catch (err) {
    console.error(err);
    return res.status(500).send('Error interno');
  }
});


  // Ruta de prueba
  app.get("/", (req, res) => {
    res.send("Bienvenido al catálogo-service");
  });

  app.listen(PORT, () => {
    console.log(`->>>>Microservicio catálogo corriendo en http://localhost:${PORT}`);
  });
}

main();
