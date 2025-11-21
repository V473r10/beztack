# T3 Env - Environment Variables Validation

Este proyecto utiliza [T3 Env](https://env.t3.gg) para validar las variables de entorno en **build time** en todas las aplicaciones del monorepo.

## 🎯 Beneficios

- ✅ **Validación en build time**: El build falla si faltan variables de entorno requeridas
- ✅ **Type safety**: Autocompletado y type checking para todas las variables de entorno
- ✅ **Transformaciones**: Convierte tipos automáticamente (ej: strings → numbers)
- ✅ **Valores por defecto**: Define valores por defecto para variables opcionales
- ✅ **Separación cliente/servidor**: Protege variables de servidor de ser expuestas al cliente

## 📦 Aplicaciones

### 1. apps/api (Nitro/Node.js)

**Archivo**: `apps/api/env.ts`

**Framework**: `@t3-oss/env-core`

**Variables**:
- `DATABASE_URL` - URL de conexión a PostgreSQL
- `BETTER_AUTH_*` - Configuración de autenticación
- `POLAR_*` - Integración con Polar.sh
- `RESEND_*` - Configuración de email
- `NODE_ENV` - Entorno de ejecución

**Uso**:
```typescript
import { env } from "@/env";

// Todas las variables son type-safe
const dbUrl = env.DATABASE_URL; // string (URL validada)
const nodeEnv = env.NODE_ENV; // "development" | "production" | "test"
```

### 2. apps/ui (Vite + React)

**Archivo**: `apps/ui/src/env.ts`

**Framework**: `@t3-oss/env-core`

**Prefijo cliente**: `VITE_`

**Variables**:
- `VITE_API_URL` - URL del API backend
- `VITE_BASE_PATH` - Path base para el router (opcional)

**Uso**:
```typescript
import { env } from "@/env";

// Variables de cliente con prefijo VITE_
const apiUrl = env.VITE_API_URL; // string (URL validada)
```

### 3. apps/landing (Next.js)

**Archivo**: `apps/landing/env.ts`

**Framework**: `@t3-oss/env-nextjs`

**Prefijo cliente**: `NEXT_PUBLIC_`

**Variables**: Configuración básica de Next.js (actualmente solo `NODE_ENV`)

**Uso**:
```typescript
import { env } from "@/env";

// Variables de servidor y cliente separadas
const nodeEnv = env.NODE_ENV; // Solo en servidor
// const publicVar = env.NEXT_PUBLIC_EXAMPLE; // En cliente y servidor
```

### 4. apps/docs (Next.js)

**Archivo**: `apps/docs/env.ts`

**Framework**: `@t3-oss/env-nextjs`

**Configuración**: Igual que landing, adaptable según necesidades de la documentación

## 🔧 Cómo Agregar Nuevas Variables

### Para apps/api (Nitro):

1. Edita `apps/api/env.ts`:
```typescript
export const env = createEnv({
  server: {
    // Agregar nueva variable
    NEW_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
```

2. Actualiza `.env.example`:
```bash
NEW_API_KEY=your_api_key_here
```

3. Usa la variable:
```typescript
import { env } from "@/env";
const apiKey = env.NEW_API_KEY;
```

### Para apps/ui (Vite):

1. Edita `apps/ui/src/env.ts`:
```typescript
export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // Debe empezar con VITE_
    VITE_NEW_FEATURE_FLAG: z.boolean().default(false),
  },
  runtimeEnv: import.meta.env,
  emptyStringAsUndefined: true,
});
```

2. Actualiza `.env.example`:
```bash
VITE_NEW_FEATURE_FLAG=true
```

### Para apps/landing o apps/docs (Next.js):

1. Edita `env.ts`:
```typescript
export const env = createEnv({
  server: {
    // Variables solo en servidor
    SECRET_KEY: z.string().min(1),
  },
  client: {
    // Variables expuestas al cliente (deben empezar con NEXT_PUBLIC_)
    NEXT_PUBLIC_API_URL: z.string().url(),
  },
  experimental__runtimeEnv: {
    // Solo destructurar variables de cliente
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
  emptyStringAsUndefined: true,
});
```

## 📝 Tipos de Validación Comunes

### Strings
```typescript
API_KEY: z.string().min(1), // String no vacío
EMAIL: z.string().email(), // Email válido
URL: z.string().url(), // URL válida
UUID: z.string().uuid(), // UUID válido
```

### Numbers
```typescript
PORT: z.coerce.number().min(1000).max(9999), // Puerto
MAX_CONNECTIONS: z.coerce.number().default(100), // Con valor por defecto
```

### Booleans
```typescript
ENABLE_FEATURE: z
  .string()
  .transform((s) => s === "true")
  .pipe(z.boolean()), // "true" | "false" → boolean
```

### Enums
```typescript
NODE_ENV: z.enum(["development", "production", "test"]),
LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]),
```

### Opcionales con Defaults
```typescript
APP_NAME: z.string().default("beztack"),
MAX_RETRIES: z.coerce.number().default(3),
```

## 🚨 Errores Comunes

### ❌ Error: Variable de entorno faltante

```
Error: Missing environment variable: DATABASE_URL
```

**Solución**: Agrega la variable a tu archivo `.env`:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
```

### ❌ Error: Tipo inválido

```
Error: Expected string, received number at "PORT"
```

**Solución**: Usa `z.coerce.number()` para convertir strings a números:
```typescript
PORT: z.coerce.number(), // "3000" → 3000
```

### ❌ Error: Variable de cliente sin prefijo

Para Vite:
```typescript
// ❌ Incorrecto - falta prefijo VITE_
client: {
  API_URL: z.string().url(),
}

// ✅ Correcto
client: {
  VITE_API_URL: z.string().url(),
}
```

Para Next.js:
```typescript
// ❌ Incorrecto - falta prefijo NEXT_PUBLIC_
client: {
  API_URL: z.string().url(),
}

// ✅ Correcto
client: {
  NEXT_PUBLIC_API_URL: z.string().url(),
}
```

## 🔒 Seguridad

### Variables de Servidor vs Cliente

**Regla de oro**: Las variables de servidor **NUNCA** deben ser accesibles desde el cliente.

**apps/api** (Nitro):
- Todas las variables son de servidor
- Nunca se exponen al navegador

**apps/ui** (Vite):
- Solo variables con prefijo `VITE_` son accesibles en el cliente
- Las demás se excluyen del bundle

**apps/landing y apps/docs** (Next.js):
- Variables en `server` son solo para servidor
- Variables en `client` (con `NEXT_PUBLIC_`) se exponen al navegador
- Separar por seguridad si los nombres de las variables son sensibles

### Mejores Prácticas

1. ✅ **Nunca** incluyas secrets en variables de cliente
2. ✅ **Nunca** uses `VITE_` o `NEXT_PUBLIC_` para API keys o secrets
3. ✅ Usa variables de servidor para tokens, claves privadas, etc.
4. ✅ Valida URLs, emails, y UUIDs con los validadores de Zod
5. ✅ Define valores por defecto para variables opcionales

## 🧪 Testing

Las variables de entorno se validan automáticamente en:

- **Build time**: `pnpm build` - Falla si faltan variables
- **Dev time**: Al iniciar el dev server
- **Config files**: Al cargar configuraciones (next.config, vite.config, nitro.config)

## 📚 Referencias

- [T3 Env Documentation](https://env.t3.gg/docs/introduction)
- [Zod Documentation](https://zod.dev/)
- [Core Package](https://env.t3.gg/docs/core) - Para Nitro, Vite, etc.
- [Next.js Package](https://env.t3.gg/docs/nextjs) - Para Next.js
- [Recipes](https://env.t3.gg/docs/recipes) - Ejemplos comunes
