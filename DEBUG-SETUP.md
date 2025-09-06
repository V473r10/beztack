# 🐛 Configuración de Debugging para VSCode

## Configuraciones Disponibles

El debugger de VSCode está configurado para funcionar con tu monorepo Vite + React + Nitro usando las siguientes configuraciones:

### 🚀 Configuraciones Individuales

#### 1. **🚀 Launch UI (React + Vite)**
- **Uso**: Inicia la aplicación frontend React con Vite
- **Puerto**: http://localhost:5173
- **Sourcemaps**: Habilitados para debugging completo

#### 2. **🔧 Launch API (Nitro)**
- **Uso**: Inicia la API backend con Nitro
- **Debugging**: Habilitado con sourcemaps
- **Watch mode**: Recarga automática en cambios

#### 3. **🌐 Launch Chrome (Frontend Debug)**
- **Uso**: Abre Chrome y se conecta automáticamente al frontend
- **Breakpoints**: Funciona directamente en el código TypeScript/React
- **URL**: http://localhost:5173

#### 4. **🔍 Debug API with Nitro**
- **Uso**: Debugging avanzado de la API con inspector Node.js
- **Breakpoints**: Funciona en el código del servidor Nitro

### 🔄 Configuraciones Compound (Full Stack)

#### 1. **🚀 Launch Full Stack (UI + API)**
- Inicia frontend y backend simultáneamente
- Ideal para desarrollo general
- Se detienen ambos al parar la sesión

#### 2. **🐛 Debug Full Stack (Chrome + API)**
- Debugging completo de frontend y backend
- Chrome se conecta automáticamente
- Breakpoints funcionan en ambos lados

## 📋 Cómo Usar

### Opción 1: Panel de Run and Debug
1. Abre el panel `Run and Debug` (Ctrl+Shift+D)
2. Selecciona la configuración deseada del dropdown
3. Presiona F5 o hace clic en el botón play

### Opción 2: Command Palette
1. Abre Command Palette (Ctrl+Shift+P)
2. Escribe "Debug: Select and Start Debugging"
3. Selecciona la configuración

### Opción 3: Teclado
- **F5**: Inicia debugging con la configuración seleccionada
- **Ctrl+F5**: Ejecuta sin debugging
- **Shift+F5**: Detiene debugging

## 🎯 Debugging Tips

### Frontend (React + Vite)
- Los breakpoints funcionan directamente en archivos `.tsx` y `.ts`
- Usa `debugger;` para breakpoints programáticos
- Chrome DevTools están disponibles para inspección avanzada

### Backend (Nitro API)
- Los breakpoints funcionan en archivos del servidor (`apps/api/server/`)
- Variables y stack trace disponibles en VSCode
- Hot reload habilitado para cambios rápidos

### Debugging Conjunto
- Usa la configuración compound para depurar requests completos
- Frontend → Backend flow totalmente trazeable
- Network requests visibles en Chrome DevTools

## ⚙️ Configuraciones de Archivos Modificadas

### `apps/ui/vite.config.ts`
- Sourcemaps habilitados para build
- Puerto fijo en 5173
- Host habilitado para acceso externo

### `apps/api/nitro.config.ts`
- Sourcemaps habilitados
- Watch mode para hot reload
- TypeScript config optimizado

## 🔧 Comandos de Terminal Equivalentes

Si prefieres usar terminal:

```bash
# Frontend
cd apps/ui && pnpm dev

# Backend  
cd apps/api && pnpm dev

# Ambos (desde root)
pnpm dev
```

## 🛠️ Troubleshooting

### Si el debugging no funciona:
1. Verifica que las dependencias estén instaladas: `pnpm install`
2. Reinicia VSCode
3. Limpia cache de Vite: `cd apps/ui && pnpm dev --force`

### Si Chrome no se conecta:
1. Cierra todas las instancias de Chrome
2. Usa la configuración "Launch Chrome" en lugar de "Attach"
3. Verifica que el puerto 5173 esté libre

### Si los breakpoints no se activan:
1. Verifica que los sourcemaps estén habilitados
2. Asegúrate de que el archivo esté guardado
3. Recompila si es necesario
