# Imagen base oficial de Node.js
FROM node:18

# Carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del proyecto
COPY . .

# Exponer el puerto donde corre tu app
EXPOSE 3000

# Comando por defecto para iniciar la app
CMD ["npm", "start"]
